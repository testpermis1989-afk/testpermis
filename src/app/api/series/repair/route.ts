import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { supabase, uploadFile, downloadFile, listFiles } from '@/lib/supabase';
import { compressMp3, compressMp4 } from '@/lib/media-compress';

// Lazy load Jimp - 100% JavaScript, works in Electron without native binaries
let jimpModule: any = null;
function getJimp() {
  if (!jimpModule) {
    try {
      jimpModule = require('jimp');
      if (!jimpModule.Jimp) jimpModule = null;
    } catch (e) {
      console.warn('[jimp] Module not available:', (e as Error).message);
    }
  }
  return jimpModule;
}

// Helper: compress/repair image using Jimp v1.x API
async function jimpCompress(fileData: Buffer): Promise<Buffer | null> {
  const JimpMod = getJimp();
  if (!JimpMod) return null;
  try {
    const Jimp = JimpMod.Jimp;
    const image = await Jimp.read(fileData);
    image.scaleToFit({ w: 1024, h: 1024 });
    const outputBuffer = await image.getBuffer('image/jpeg');
    return outputBuffer;
  } catch {
    return null;
  }
}

// POST /api/series/repair - Réparer les fichiers corrompus d'une série existante
// Images: réparées avec Jimp (100% JavaScript)
// Audio: réparées + compressées avec FFmpeg (64kbps mono)
// Vidéo: réparées + compressées avec FFmpeg (480p H.264)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, serie } = body;

    if (!category || !serie) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const storagePrefix = `series/${category}/${serie}`;

    const report = {
      repaired: [] as string[],
      removed: [] as string[],
      skipped: [] as string[],
      errors: [] as string[],
    };

    // ===== RÉPARER LES IMAGES (Jimp - 100% JavaScript, no native binaries!) =====
    const imagesFolder = `${storagePrefix}/images`;
    try {
      const images = await listFiles(imagesFolder);
      for (const img of images) {
        const ext = path.extname(img).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.webp'].includes(ext)) continue;

        const imgStoragePath = `${imagesFolder}/${img}`;
        try {
          const fileData = await downloadFile(imgStoragePath);
          if (isValidImage(fileData)) continue; // Déjà valide

          // Réparer avec Jimp (Buffer-based, no native binaries!)
          const outputBuffer = await jimpCompress(fileData);
          if (!outputBuffer) {
            report.removed.push(`images/${img} — Corrompue (Jimp non disponible)`);
            continue;
          }

          if (outputBuffer.length > 0) {
            const newImgName = img.replace(/\.[^.]+$/, '.jpg');
            const newStoragePath = `${imagesFolder}/${newImgName}`;
            await uploadFile(newStoragePath, outputBuffer, 'image/jpeg');
            report.repaired.push(`images/${img} → ${newImgName} ✓`);

            // Remove old file if name changed
            if (newImgName !== img) {
              try { await supabase.storage.from('uploads').remove([imgStoragePath]); } catch {}
            }
          } else {
            try { await supabase.storage.from('uploads').remove([imgStoragePath]); } catch {}
            report.removed.push(`images/${img}`);
          }
        } catch (err) {
          console.error(`Error downloading image ${img}:`, err);
        }
      }
    } catch {}

    // ===== RÉPARER LES IMAGES DE RÉPONSES =====
    const responsesFolder = `${storagePrefix}/responses`;
    try {
      const responses = await listFiles(responsesFolder);
      for (const resp of responses) {
        const ext = path.extname(resp).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.webp'].includes(ext)) continue;

        const respStoragePath = `${responsesFolder}/${resp}`;
        try {
          const fileData = await downloadFile(respStoragePath);
          if (isValidImage(fileData)) continue;

          const outputBuffer = await jimpCompress(fileData);
          if (!outputBuffer) {
            report.removed.push(`responses/${resp} — Corrompue (Jimp non disponible)`);
            continue;
          }

          if (outputBuffer.length > 0) {
            const newRespName = resp.replace(/\.[^.]+$/, '.jpg');
            const newStoragePath = `${responsesFolder}/${newRespName}`;
            await uploadFile(newStoragePath, outputBuffer, 'image/jpeg');
            report.repaired.push(`responses/${resp} → ${newRespName} ✓`);
            if (newRespName !== resp) {
              try { await supabase.storage.from('uploads').remove([respStoragePath]); } catch {}
            }
          } else {
            try { await supabase.storage.from('uploads').remove([respStoragePath]); } catch {}
            report.removed.push(`responses/${resp}`);
          }
        } catch (err) {
          console.error(`Error downloading response ${resp}:`, err);
        }
      }
    } catch {}

    // ===== AUDIO MP3 - repair + compress with FFmpeg =====
    const audioFolder = `${storagePrefix}/audio`;
    try {
      const audios = await listFiles(audioFolder);
      for (const audio of audios) {
        if (!audio.toLowerCase().endsWith('.mp3')) continue;

        const audioStoragePath = `${audioFolder}/${audio}`;
        try {
          const fileData = await downloadFile(audioStoragePath);
          const originalSize = fileData.length;

          if (!isValidMp3(fileData) && fileData.length < 1000) {
            try { await supabase.storage.from('uploads').remove([audioStoragePath]); } catch {}
            report.removed.push(`audio/${audio} — Corrompu (trop petit: ${fileData.length} octets)`);
            continue;
          }

          // Try to compress with FFmpeg
          try {
            const compressed = await compressMp3(fileData);
            if (compressed && compressed.length < originalSize) {
              await uploadFile(audioStoragePath, compressed, 'audio/mpeg');
              report.repaired.push(`audio/${audio} — Compressé (${(originalSize / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB) ✓`);
            } else if (!isValidMp3(fileData)) {
              report.skipped.push(`audio/${audio} — Conservé (headers non standards)`);
            }
          } catch {
            if (!isValidMp3(fileData)) {
              report.skipped.push(`audio/${audio} — Conservé (compression échouée)`);
            }
          }
        } catch (err) {
          console.error(`Error downloading audio ${audio}:`, err);
        }
      }
    } catch {}

    // ===== VIDÉO MP4 - repair + compress with FFmpeg =====
    const videoFolder = `${storagePrefix}/video`;
    try {
      const videos = await listFiles(videoFolder);
      for (const video of videos) {
        if (!video.toLowerCase().endsWith('.mp4')) continue;

        const videoStoragePath = `${videoFolder}/${video}`;
        try {
          const fileData = await downloadFile(videoStoragePath);
          const originalSize = fileData.length;

          if (!isValidMp4(fileData) && fileData.length < 10000) {
            try { await supabase.storage.from('uploads').remove([videoStoragePath]); } catch {}
            report.removed.push(`video/${video} — Corrompue (trop petite: ${fileData.length} octets)`);
            continue;
          }

          // Try to compress with FFmpeg
          try {
            const compressed = await compressMp4(fileData);
            if (compressed && compressed.length < originalSize) {
              await uploadFile(videoStoragePath, compressed, 'video/mp4');
              report.repaired.push(`video/${video} — Compressé (${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(compressed.length / 1024 / 1024).toFixed(1)}MB) ✓`);
            } else if (!isValidMp4(fileData)) {
              report.skipped.push(`video/${video} — Conservée (container non standard)`);
            }
          } catch {
            if (!isValidMp4(fileData)) {
              report.skipped.push(`video/${video} — Conservée (compression échouée)`);
            }
          }
        } catch (err) {
          console.error(`Error downloading video ${video}:`, err);
        }
      }
    } catch {}

    // ===== ALSO CHECK LOCAL FILES (for Electron app) =====
    if (process.env.STORAGE_MODE === 'local') {
      const localBase = process.env.LOCAL_DATA_DIR || path.join(process.cwd(), 'data', 'uploads');
      const localSeriePath = path.join(localBase, 'series', category, String(serie));

      // Repair local images
      const localImagesDir = path.join(localSeriePath, 'images');
      if (fs.existsSync(localImagesDir)) {
        for (const file of fs.readdirSync(localImagesDir)) {
          const ext = path.extname(file).toLowerCase();
          if (!['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.webp'].includes(ext)) continue;

          const filePath = path.join(localImagesDir, file);
          try {
            const fileData = fs.readFileSync(filePath);
            if (isValidImage(fileData)) continue;

            const outputBuffer = await jimpCompress(fileData);
            if (!outputBuffer) continue;

            if (outputBuffer.length > 0) {
              const newName = file.replace(/\.[^.]+$/, '.jpg');
              fs.writeFileSync(path.join(localImagesDir, newName), outputBuffer);
              if (newName !== file) {
                try { fs.unlinkSync(filePath); } catch {}
              }
              report.repaired.push(`[local] images/${file} → ${newName} ✓`);
            } else {
              try { fs.unlinkSync(filePath); } catch {}
              report.removed.push(`[local] images/${file}`);
            }
          } catch {}
        }
      }

      // Repair local response images
      const localResponsesDir = path.join(localSeriePath, 'responses');
      if (fs.existsSync(localResponsesDir)) {
        for (const file of fs.readdirSync(localResponsesDir)) {
          const ext = path.extname(file).toLowerCase();
          if (!['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.webp'].includes(ext)) continue;

          const filePath = path.join(localResponsesDir, file);
          try {
            const fileData = fs.readFileSync(filePath);
            if (isValidImage(fileData)) continue;

            const outputBuffer = await jimpCompress(fileData);
            if (!outputBuffer) continue;

            if (outputBuffer.length > 0) {
              const newName = file.replace(/\.[^.]+$/, '.jpg');
              fs.writeFileSync(path.join(localResponsesDir, newName), outputBuffer);
              if (newName !== file) {
                try { fs.unlinkSync(filePath); } catch {}
              }
              report.repaired.push(`[local] responses/${file} → ${newName} ✓`);
            } else {
              try { fs.unlinkSync(filePath); } catch {}
              report.removed.push(`[local] responses/${file}`);
            }
          } catch {}
        }
      }

      // Repair + compress local audio with FFmpeg
      const localAudioDir = path.join(localSeriePath, 'audio');
      if (fs.existsSync(localAudioDir)) {
        for (const file of fs.readdirSync(localAudioDir)) {
          if (!file.toLowerCase().endsWith('.mp3')) continue;
          const filePath = path.join(localAudioDir, file);
          try {
            const fileData = fs.readFileSync(filePath);
            if (!isValidMp3(fileData) && fileData.length < 1000) {
              try { fs.unlinkSync(filePath); } catch {}
              report.removed.push(`[local] audio/${file} — Corrompu`);
              continue;
            }
            // Try to compress
            try {
              const compressed = await compressMp3(fileData);
              if (compressed && compressed.length < fileData.length) {
                fs.writeFileSync(filePath, compressed);
                report.repaired.push(`[local] audio/${file} — Compressé ✓`);
              }
            } catch {}
          } catch {}
        }
      }

      // Repair + compress local video with FFmpeg
      const localVideoDir = path.join(localSeriePath, 'video');
      if (fs.existsSync(localVideoDir)) {
        for (const file of fs.readdirSync(localVideoDir)) {
          if (!file.toLowerCase().endsWith('.mp4')) continue;
          const filePath = path.join(localVideoDir, file);
          try {
            const fileData = fs.readFileSync(filePath);
            if (!isValidMp4(fileData) && fileData.length < 10000) {
              try { fs.unlinkSync(filePath); } catch {}
              report.removed.push(`[local] video/${file} — Corrompue`);
              continue;
            }
            // Try to compress
            try {
              const compressed = await compressMp4(fileData);
              if (compressed && compressed.length < fileData.length) {
                fs.writeFileSync(filePath, compressed);
                report.repaired.push(`[local] video/${file} — Compressé ✓`);
              }
            } catch {}
          } catch {}
        }
      }
    }

    return NextResponse.json({
      success: true,
      report,
      summary: {
        totalRepaired: report.repaired.length,
        totalRemoved: report.removed.length,
        totalSkipped: report.skipped.length,
      }
    });
  } catch (error) {
    console.error('Series repair error:', error);
    return NextResponse.json({ error: 'Réparation échouée: ' + (error as Error).message }, { status: 500 });
  }
}

function isValidImage(data: Buffer): boolean {
  if (data.length < 8) return false;
  const h = data.slice(0, 16);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return true; // PNG
  if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return true; // JPEG
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38) return true; // GIF
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return true; // WebP/RIFF
  if (h[0] === 0x42 && h[1] === 0x4D) return true; // BMP
  return false;
}

function isValidMp3(data: Buffer): boolean {
  if (data.length < 10) return false;
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true;
  if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true;
  return false;
}

function isValidMp4(data: Buffer): boolean {
  if (data.length < 12) return false;
  const ftyp = data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
  const moov = data[4] === 0x6D && data[5] === 0x6F && data[6] === 0x6F && data[7] === 0x76;
  const mdat = data[4] === 0x6D && data[5] === 0x64 && data[6] === 0x61 && data[7] === 0x74;
  const ftyp0 = data[0] === 0x66 && data[1] === 0x74 && data[2] === 0x79 && data[3] === 0x70;
  return ftyp || moov || mdat || ftyp0;
}
