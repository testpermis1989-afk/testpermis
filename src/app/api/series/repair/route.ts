import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { supabase, uploadFile, downloadFile, listFiles } from '@/lib/supabase';

// Lazy load sharp - optional, may not work in Electron's Node.js ABI
let sharpModule: typeof import('sharp') | null = null;
function getSharp() {
  if (!sharpModule) {
    try { sharpModule = require('sharp'); } catch (e) {
      console.warn('[sharp] Module not available:', (e as Error).message);
    }
  }
  return sharpModule;
}

// POST /api/series/repair - Réparer les fichiers corrompus d'une série existante (from Supabase Storage)
// Serverless-compatible: uses sharp with Buffers, skips ffmpeg (not available on Vercel)
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
      errors: [] as string[],
    };

    // Réparer les images (sharp with Buffers - no filesystem needed!)
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

          // Réparer avec sharp (Buffer-based, no filesystem!)
          const sharp = getSharp();
          if (!sharp) {
            try {
              await supabase.storage.from('uploads').remove([imgStoragePath]);
            } catch {}
            report.removed.push(`images/${img}`);
            continue;
          }
          try {
            const outputBuffer = await sharp(fileData)
              .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 75 })
              .toBuffer();

            if (outputBuffer.length > 0 && isValidImage(outputBuffer)) {
              const newImgName = img.replace(/\.[^.]+$/, '.webp');
              const newStoragePath = `${imagesFolder}/${newImgName}`;
              await uploadFile(newStoragePath, outputBuffer, 'image/webp');
              report.repaired.push(`images/${img} → ${newImgName}`);

              // Remove old file if name changed
              if (newImgName !== img) {
                try {
                  await supabase.storage.from('uploads').remove([imgStoragePath]);
                } catch {}
              }
            } else {
              try {
                await supabase.storage.from('uploads').remove([imgStoragePath]);
              } catch {}
              report.removed.push(`images/${img}`);
            }
          } catch {
            try {
              await supabase.storage.from('uploads').remove([imgStoragePath]);
            } catch {}
            report.removed.push(`images/${img}`);
          }
        } catch (err) {
          console.error(`Error downloading image ${img}:`, err);
        }
      }
    } catch {}

    // Réparer les images de réponses
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

          const sharp = getSharp();
          if (!sharp) {
            try {
              await supabase.storage.from('uploads').remove([respStoragePath]);
            } catch {}
            report.removed.push(`responses/${resp}`);
            continue;
          }
          try {
            const outputBuffer = await sharp(fileData)
              .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 75 })
              .toBuffer();

            if (outputBuffer.length > 0 && isValidImage(outputBuffer)) {
              const newRespName = resp.replace(/\.[^.]+$/, '.webp');
              const newStoragePath = `${responsesFolder}/${newRespName}`;
              await uploadFile(newStoragePath, outputBuffer, 'image/webp');
              report.repaired.push(`responses/${resp} → ${newRespName}`);
              if (newRespName !== resp) {
                try {
                  await supabase.storage.from('uploads').remove([respStoragePath]);
                } catch {}
              }
            } else {
              try {
                await supabase.storage.from('uploads').remove([respStoragePath]);
              } catch {}
              report.removed.push(`responses/${resp}`);
            }
          } catch {
            try {
              await supabase.storage.from('uploads').remove([respStoragePath]);
            } catch {}
            report.removed.push(`responses/${resp}`);
          }
        } catch (err) {
          console.error(`Error downloading response ${resp}:`, err);
        }
      }
    } catch {}

    // Audio MP3 - vérifier mais ne pas réparer (ffmpeg non disponible sur Vercel)
    const audioFolder = `${storagePrefix}/audio`;
    try {
      const audios = await listFiles(audioFolder);
      for (const audio of audios) {
        if (!audio.toLowerCase().endsWith('.mp3')) continue;

        const audioStoragePath = `${audioFolder}/${audio}`;
        try {
          const fileData = await downloadFile(audioStoragePath);
          if (isValidMp3(fileData)) continue;

          // Can't repair without ffmpeg - just report
          report.errors.push(`audio/${audio} — corrompu (ffmpeg non disponible sur serveur)`);
        } catch (err) {
          console.error(`Error downloading audio ${audio}:`, err);
        }
      }
    } catch {}

    // Vidéo MP4 - vérifier mais ne pas réparer (ffmpeg non disponible sur Vercel)
    const videoFolder = `${storagePrefix}/video`;
    try {
      const videos = await listFiles(videoFolder);
      for (const video of videos) {
        if (!video.toLowerCase().endsWith('.mp4')) continue;

        const videoStoragePath = `${videoFolder}/${video}`;
        try {
          const fileData = await downloadFile(videoStoragePath);
          if (isValidMp4(fileData)) continue;

          // Can't repair without ffmpeg - just report
          report.errors.push(`video/${video} — corrompu (ffmpeg non disponible sur serveur)`);
        } catch (err) {
          console.error(`Error downloading video ${video}:`, err);
        }
      }
    } catch {}

    return NextResponse.json({
      success: true,
      report,
      summary: {
        totalRepaired: report.repaired.length,
        totalRemoved: report.removed.length,
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
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return true;
  if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return true;
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38) return true;
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return true;
  if (h[0] === 0x42 && h[1] === 0x4D) return true;
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
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true;
  if (data[4] === 0x6D && data[5] === 0x6F && data[6] === 0x6F && data[7] === 0x76) return true;
  if (data[4] === 0x6D && data[5] === 0x64 && data[6] === 0x61 && data[7] === 0x74) return true;
  return false;
}
