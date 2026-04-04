import { NextRequest, NextResponse } from 'next/server';
import { mkdir, unlink, readFile, writeFile, rm, stat } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import AdmZip from 'adm-zip';
import os from 'os';

// POST /api/upload/rar/compress - Compresser les fichiers d'un ZIP temporaire avant import
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const importId = body.importId;
    const zipBufferBase64 = body.zipBuffer;
    const skipCorrupted = body.skipCorrupted === true;

    if (!importId || !zipBufferBase64) {
      return NextResponse.json({ error: 'Missing importId or zipBuffer' }, { status: 400 });
    }

    const zipBuffer = Buffer.from(zipBufferBase64, 'base64');
    const tempExtractDir = path.join(os.tmpdir(), `compress_${importId}`);
    await mkdir(tempExtractDir, { recursive: true });

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

      // Taille avant compression
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

        // Compress images → WebP (répare aussi les corrompus)
        if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff'].includes(ext)) {
          const isResponse = /repons/i.test(dirName) || /^r\d+/i.test(baseName);
          const originalSize = fileData.length;
          const isCorrupted = !isValidImage(fileData);
          try {
            const tmpIn = path.join(tempExtractDir, `in_${baseName}`);
            const tmpOut = path.join(tempExtractDir, `out_${baseName.replace(/\.[^.]+$/, '.webp')}`);
            await writeFile(tmpIn, fileData);

            await sharp(tmpIn)
              .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 75 })
              .toFile(tmpOut);

            const outData = await readFile(tmpOut);
            const newBaseName = baseName.replace(/\.[^.]+$/, '.webp');
            newZip.addFile(stripParent + dirName + newBaseName, outData);
            const key = isResponse ? 'responses' : 'images';
            result[key].compressed++;
            result[key].beforeBytes += originalSize;
            result[key].afterBytes += outData.length;
            if (isCorrupted) result[key].repaired = (result[key].repaired || 0) + 1;
            await unlink(tmpIn).catch(() => {});
            await unlink(tmpOut).catch(() => {});
            continue;
          } catch {
            if (skipCorrupted && isCorrupted) continue;
          }
        }

        // Compress audio → 64kbps mono (répare aussi les corrompus avec ffmpeg)
        if (ext === '.mp3') {
          const originalSize = fileData.length;
          const isCorrupted = !isValidMp3(fileData);
          try {
            const tempFile = path.join(tempExtractDir, baseName);
            const outFile = path.join(tempExtractDir, `c_${baseName}`);
            await writeFile(tempFile, fileData);

            await new Promise<void>((resolve, reject) => {
              ffmpeg(tempFile)
                .audioBitrate('64k')
                .audioChannels(1)
                .output(outFile)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });

            const compressed = await readFile(outFile);
            if (compressed.length > 0 && isValidMp3(compressed)) {
              newZip.addFile(stripParent + dirName + baseName, compressed);
              result.audio.compressed++;
              result.audio.beforeBytes += originalSize;
              result.audio.afterBytes += compressed.length;
              if (isCorrupted) result.audio.repaired = (result.audio.repaired || 0) + 1;
            } else if (!isCorrupted) {
              newZip.addFile(stripParent + dirName + baseName, fileData);
            }
            await unlink(tempFile).catch(() => {});
            await unlink(outFile).catch(() => {});
            continue;
          } catch {
            if (skipCorrupted && isCorrupted) continue;
            newZip.addFile(stripParent + dirName + baseName, fileData);
            continue;
          }
        }

        // Compress vidéo → 480p
        if (ext === '.mp4') {
          const originalSize = fileData.length;
          try {
            const tempFile = path.join(tempExtractDir, baseName);
            const outFile = path.join(tempExtractDir, `c_${baseName}`);
            await writeFile(tempFile, fileData);

            await new Promise<void>((resolve, reject) => {
              ffmpeg(tempFile)
                .size('854x480')
                .videoBitrate('500k')
                .audioBitrate('64k')
                .output(outFile)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });

            const compressed = await readFile(outFile);
            newZip.addFile(stripParent + dirName + baseName, compressed);
            result.video.compressed++;
            result.video.beforeBytes += originalSize;
            result.video.afterBytes += compressed.length;
            await unlink(tempFile).catch(() => {});
            await unlink(outFile).catch(() => {});
            continue;
          } catch {
            // fallback
          }
        }

        // Autres fichiers (TXT, etc.) → garder tel quel
        newZip.addFile(entry.entryName, fileData);
      }

      // Return the compressed ZIP as base64
      const compressedBuffer = newZip.toBuffer();

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
      });
    } finally {
      // Cleanup temp extract
      try {
        await rm(tempExtractDir, { recursive: true, force: true });
      } catch {}
    }
  } catch (error) {
    console.error('Compress before import error:', error);
    return NextResponse.json({ error: 'Compression failed: ' + (error as Error).message }, { status: 500 });
  }
}

// Helpers de validation des fichiers
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

function isValidMp3(data: Buffer): boolean {
  if (data.length < 10) return false;
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true; // ID3
  if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true; // MP3 sync
  return false;
}

function isValidMp4(data: Buffer): boolean {
  if (data.length < 12) return false;
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true; // ftyp
  if (data[4] === 0x6D && data[5] === 0x6F && data[6] === 0x6F && data[7] === 0x76) return true; // moov
  if (data[4] === 0x6D && data[5] === 0x64 && data[6] === 0x61 && data[7] === 0x74) return true; // mdat
  return false;
}
