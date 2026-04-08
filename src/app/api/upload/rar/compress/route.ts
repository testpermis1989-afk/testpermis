import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import AdmZip from 'adm-zip';
import { getUploadBuffer, getUploadJob, deleteUploadJob, hasUploadJob } from '@/lib/upload-store';

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

// POST /api/upload/rar/compress - Compress files before import
// Uses Jimp with Buffers (100% JavaScript, no native binaries needed)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const importId = body.importId;

    if (!importId) {
      return NextResponse.json({ error: 'Missing importId' }, { status: 400 });
    }

    // Get ZIP buffer from Supabase temp storage
    const jobExists = await hasUploadJob(importId);
    if (!jobExists) {
      return NextResponse.json({ error: 'Fichier expiré, veuillez ré-uploader' }, { status: 400 });
    }

    const zipBuffer = await getUploadBuffer(importId);
    if (!zipBuffer) {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 400 });
    }

    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      // Auto-detect parent folder
      const topLevelDirs = new Set<string>();
      for (const entry of entries) {
        const parts = entry.entryName.split('/').filter(Boolean);
        if (parts.length >= 2) topLevelDirs.add(parts[0].toLowerCase());
      }
      let stripParent = '';
      if (topLevelDirs.size === 1) stripParent = [...topLevelDirs][0] + '/';

      // Size before compression
      let beforeSize = 0;
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        try { beforeSize += entry.header.size; } catch {}
      }

      const result = {
        images: { compressed: 0, beforeBytes: 0, afterBytes: 0, repaired: 0 as number },
        audio: { compressed: 0, beforeBytes: 0, afterBytes: 0, repaired: 0 as number },
        video: { compressed: 0, beforeBytes: 0, afterBytes: 0, repaired: 0 as number },
        responses: { compressed: 0, beforeBytes: 0, afterBytes: 0, repaired: 0 as number },
      };

      const newZip = new AdmZip();

      for (const entry of entries) {
        if (entry.isDirectory) {
          newZip.addFile(entry.entryName, Buffer.alloc(0));
          continue;
        }

        let entryName = entry.entryName;
        if (stripParent && entryName.startsWith(stripParent)) {
          entryName = entryName.substring(stripParent.length);
        }

        const ext = path.extname(entryName).toLowerCase();
        const baseName = path.basename(entryName);
        const dirName = entryName.substring(0, entryName.length - baseName.length);
        let fileData = entry.getData();

        // Compress images → JPEG using Jimp with Buffers (no native binaries needed!)
        if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff'].includes(ext)) {
          const isResponse = /repons/i.test(dirName) || /^r\d+/i.test(baseName);
          const originalSize = fileData.length;
          const isCorrupted = !isValidImage(fileData);
          try {
            // Jimp can process Buffers directly - no temp files needed
            const JimpMod = getJimp();
            if (!JimpMod) continue; // Skip compression if Jimp not available
            const Jimp = JimpMod.Jimp;
            const image = await Jimp.read(fileData);
            image.scaleToFit({ w: 1024, h: 1024 });
            const outputBuffer = await image.getBuffer('image/jpeg');

            const newBaseName = baseName.replace(/\.[^.]+$/, '.jpg');
            newZip.addFile(stripParent + dirName + newBaseName, outputBuffer);
            const key = isResponse ? 'responses' : 'images';
            result[key].compressed++;
            result[key].beforeBytes += originalSize;
            result[key].afterBytes += outputBuffer.length;
            if (isCorrupted) result[key].repaired = (result[key].repaired || 0) + 1;
            continue;
          } catch {
            if (isCorrupted) continue; // Skip corrupted files
          }
        }

        // Audio files - keep as-is (ffmpeg not available on Vercel serverless)
        if (ext === '.mp3') {
          const originalSize = fileData.length;
          newZip.addFile(stripParent + dirName + baseName, fileData);
          // Still track it as "processed" so the UI shows it
          result.audio.compressed++;
          result.audio.beforeBytes += originalSize;
          result.audio.afterBytes += originalSize;
          continue;
        }

        // Video files - keep as-is (ffmpeg not available on Vercel serverless)
        if (ext === '.mp4') {
          const originalSize = fileData.length;
          newZip.addFile(stripParent + dirName + baseName, fileData);
          result.video.compressed++;
          result.video.beforeBytes += originalSize;
          result.video.afterBytes += originalSize;
          continue;
        }

        // Other files (TXT, etc.) → keep as-is
        newZip.addFile(entry.entryName, fileData);
      }

      // Return the compressed ZIP as base64
      const compressedBuffer = newZip.toBuffer();

      // Store the compressed ZIP back in temp storage (replace the original)
      const job = await getUploadJob(importId);
      if (job) {
        const { saveUploadJob } = await import('@/lib/upload-store');
        // We save with a different key to indicate it's compressed
        await saveUploadJob(importId + '_compressed', compressedBuffer, job);
      }

      const afterSize = result.images.afterBytes + result.audio.afterBytes + result.video.afterBytes + result.responses.afterBytes;
      const beforeOnly = result.images.beforeBytes + result.audio.beforeBytes + result.video.beforeBytes + result.responses.beforeBytes;
      const totalSaved = beforeOnly - afterSize;

      return NextResponse.json({
        success: true,
        result,
        totalSaved,
        totalBefore: beforeOnly,
        totalAfter: afterSize,
        originalZipSize: beforeSize,
        compressedZipSize: compressedBuffer.length,
        zipBuffer: compressedBuffer.toString('base64'),
        compressedImportId: importId + '_compressed',
      });
    } catch (error) {
      console.error('Compress processing error:', error);
      return NextResponse.json({ error: 'Compression failed: ' + (error as Error).message }, { status: 500 });
    }
  } catch (error) {
    console.error('Compress error:', error);
    return NextResponse.json({ error: 'Compression failed: ' + (error as Error).message }, { status: 500 });
  }
}

// Helper de validation des images
function isValidImage(data: Buffer): boolean {
  if (data.length < 8) return false;
  const h = data.slice(0, 16);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return true; // PNG
  if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return true; // JPEG
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38) return true; // GIF
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return true; // WebP
  if (h[0] === 0x42 && h[1] === 0x4D) return true; // BMP
  return false;
}
