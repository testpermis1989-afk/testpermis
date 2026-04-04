import { NextRequest, NextResponse } from 'next/server';
import { mkdir, unlink, readFile, writeFile, rm } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import AdmZip from 'adm-zip';
import os from 'os';

// POST /api/upload/rar/repair - Réparer les fichiers corrompus dans un ZIP temporaire
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const importId = body.importId;
    const zipBufferBase64 = body.zipBuffer;

    if (!importId || !zipBufferBase64) {
      return NextResponse.json({ error: 'Missing importId or zipBuffer' }, { status: 400 });
    }

    const zipBuffer = Buffer.from(zipBufferBase64, 'base64');
    const tempExtractDir = path.join(os.tmpdir(), `repair_${importId}`);
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

      const report = {
        repaired: [] as string[],
        removed: [] as string[],
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

        // ===== REPAIR IMAGES =====
        if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif'].includes(ext)) {
          if (isValidImage(fileData)) {
            newZip.addFile(entry.entryName, fileData);
            continue;
          }

          const tmpIn = path.join(tempExtractDir, `repair_in_${baseName}`);
          const tmpOut = path.join(tempExtractDir, `repair_out_${baseName.replace(/\.[^.]+$/, '.webp')}`);
          try {
            await writeFile(tmpIn, fileData);
            await sharp(tmpIn)
              .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 75 })
              .toFile(tmpOut);
            const outData = await readFile(tmpOut);
            if (outData.length > 0 && isValidImage(outData)) {
              const newBaseName = baseName.replace(/\.[^.]+$/, '.webp');
              newZip.addFile(stripParent + dirName + newBaseName, outData);
              report.repaired.push(`${baseName} → Image réparée`);
            } else {
              report.removed.push(`${baseName} — Image irréparable`);
            }
          } catch {
            report.removed.push(`${baseName} — Image irréparable`);
          } finally {
            await unlink(tmpIn).catch(() => {});
            await unlink(tmpOut).catch(() => {});
          }
          continue;
        }

        // ===== REPAIR AUDIO MP3 =====
        if (ext === '.mp3') {
          if (isValidMp3(fileData)) {
            newZip.addFile(entry.entryName, fileData);
            continue;
          }

          const repaired = await tryRepairAudio(fileData, baseName, tempExtractDir);
          if (repaired && repaired.length > 0 && isValidMp3(repaired)) {
            newZip.addFile(stripParent + dirName + baseName, repaired);
            report.repaired.push(`${baseName} — Audio réparé avec ffmpeg`);
          } else {
            report.removed.push(`${baseName} — Audio irréparable`);
          }
          continue;
        }

        // ===== REPAIR VIDEO MP4 =====
        if (ext === '.mp4') {
          if (isValidMp4(fileData)) {
            newZip.addFile(entry.entryName, fileData);
            continue;
          }

          const repaired = await tryRepairVideo(fileData, baseName, tempExtractDir);
          if (repaired && repaired.length > 0 && isValidMp4(repaired)) {
            newZip.addFile(stripParent + dirName + baseName, repaired);
            report.repaired.push(`${baseName} — Vidéo réparée avec ffmpeg`);
          } else {
            report.removed.push(`${baseName} — Vidéo irréparable`);
          }
          continue;
        }

        // Autres fichiers — garder tel quel
        newZip.addFile(entry.entryName, fileData);
      }

      // Return the repaired ZIP as base64 (no filesystem storage needed)
      const repairedBuffer = newZip.toBuffer();

      // Cleanup temp
      try {
        await rm(tempExtractDir, { recursive: true, force: true });
      } catch {}

      return NextResponse.json({
        success: true,
        report,
        summary: {
          totalRepaired: report.repaired.length,
          totalRemoved: report.removed.length,
        },
        zipBuffer: repairedBuffer.toString('base64'),
      });
    } catch (error) {
      try {
        await rm(tempExtractDir, { recursive: true, force: true });
      } catch {}
      throw error;
    }
  } catch (error) {
    console.error('Repair error:', error);
    return NextResponse.json({ error: 'Réparation échouée: ' + (error as Error).message }, { status: 500 });
  }
}

// === Multiple strategies to repair corrupted MP3 ===
async function tryRepairAudio(fileData: Buffer, baseName: string, tempDir: string): Promise<Buffer | null> {
  const tmpIn = path.join(tempDir, `repair_audio_in_${baseName}`);
  const tmpOut = path.join(tempDir, `repair_audio_out_${baseName}`);

  try {
    await writeFile(tmpIn, fileData);

    // Strategy 1: Re-encode with input error tolerance flags
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tmpIn)
          .inputOptions('-err_detect', 'ignore_err')
          .inputOptions('-fflags', '+genpts+discardcorrupt')
          .audioCodec('libmp3lame')
          .audioBitrate('64k')
          .audioChannels(1)
          .output(tmpOut)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      const result = await readFile(tmpOut);
      if (result.length > 100) {
        await cleanupFiles(tmpIn, tmpOut);
        return result;
      }
    } catch {
      // Strategy 1 failed
    }

    // Strategy 2: Force treat input as mp3 with error tolerance
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tmpIn)
          .inputFormat('mp3')
          .inputOptions('-err_detect', 'ignore_err')
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate('64k')
          .audioChannels(1)
          .audioFrequency(22050)
          .output(tmpOut)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      const result = await readFile(tmpOut);
      if (result.length > 100) {
        await cleanupFiles(tmpIn, tmpOut);
        return result;
      }
    } catch {
      // Strategy 2 failed
    }

    // Strategy 3: Decode to WAV PCM first, then re-encode to MP3
    const tmpWav = path.join(tempDir, `repair_audio_wav_${Date.now()}.wav`);
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tmpIn)
          .inputOptions('-err_detect', 'ignore_err')
          .noVideo()
          .audioCodec('pcm_s16le')
          .audioFrequency(22050)
          .audioChannels(1)
          .output(tmpWav)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      try {
        await new Promise<void>((resolve, reject) => {
          ffmpeg(tmpWav)
            .audioCodec('libmp3lame')
            .audioBitrate('64k')
            .audioChannels(1)
            .audioFrequency(22050)
            .output(tmpOut)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });

        await unlink(tmpWav).catch(() => {});

        const result = await readFile(tmpOut);
        if (result.length > 100) {
          await cleanupFiles(tmpIn, tmpOut, tmpWav);
          return result;
        }
      } catch {
        await unlink(tmpWav).catch(() => {});
      }
    } catch {
      await unlink(tmpWav).catch(() => {});
    }

    await cleanupFiles(tmpIn, tmpOut);
    return null;
  } catch {
    await cleanupFiles(tmpIn, tmpOut);
    return null;
  }
}

// Try to repair corrupted MP4
async function tryRepairVideo(fileData: Buffer, baseName: string, tempDir: string): Promise<Buffer | null> {
  const tmpIn = path.join(tempDir, `repair_video_in_${baseName}`);
  const tmpOut = path.join(tempDir, `repair_video_out_${baseName}`);

  try {
    await writeFile(tmpIn, fileData);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpIn)
        .inputOptions('-err_detect', 'ignore_err')
        .videoCodec('libx264')
        .addOutputOptions('-preset', 'fast', '-crf', '28')
        .size('854x480')
        .audioCodec('aac')
        .audioBitrate('64k')
        .output(tmpOut)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const result = await readFile(tmpOut);
    if (result.length > 1000) {
      await cleanupFiles(tmpIn, tmpOut);
      return result;
    }

    await cleanupFiles(tmpIn, tmpOut);
    return null;
  } catch {
    await cleanupFiles(tmpIn, tmpOut);
    return null;
  }
}

async function cleanupFiles(...files: string[]) {
  for (const f of files) {
    await unlink(f).catch(() => {});
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
