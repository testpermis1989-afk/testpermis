import { NextRequest, NextResponse } from 'next/server';
import { mkdir, unlink, readFile, writeFile, rm, stat } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import os from 'os';
import { supabase, uploadFile, getPublicUrl, downloadFile, listFiles } from '@/lib/supabase';

// POST /api/series/repair - Réparer les fichiers corrompus d'une série existante (from Supabase Storage)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, serie } = body;

    if (!category || !serie) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const storagePrefix = `series/${category}/${serie}`;
    const tempDir = path.join(os.tmpdir(), `repair_${category}_${serie}_${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    try {
      const report = {
        repaired: [] as string[],
        removed: [] as string[],
        errors: [] as string[],
      };

      const MIME_TYPES: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
      };

      // Réparer les images
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

            // Essayer de réparer avec sharp
            const tmpIn = path.join(tempDir, `img_in_${img}`);
            const tmpOut = path.join(tempDir, `img_out_${img.replace(/\.[^.]+$/, '.webp')}`);
            try {
              await writeFile(tmpIn, fileData);
              await sharp(tmpIn)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 75 })
                .toFile(tmpOut);
              const outData = await readFile(tmpOut);
              if (outData.length > 0 && isValidImage(outData)) {
                const newImgName = img.replace(/\.[^.]+$/, '.webp');
                const newStoragePath = `${imagesFolder}/${newImgName}`;
                await uploadFile(newStoragePath, outData, 'image/webp');
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
            } finally {
              await unlink(tmpIn).catch(() => {});
              await unlink(tmpOut).catch(() => {});
            }
          } catch (err) {
            console.error(`Error downloading image ${img}:`, err);
          }
        }
      } catch {}

      // Réparer les audios
      const audioFolder = `${storagePrefix}/audio`;
      try {
        const audios = await listFiles(audioFolder);
        for (const audio of audios) {
          if (!audio.toLowerCase().endsWith('.mp3')) continue;

          const audioStoragePath = `${audioFolder}/${audio}`;
          try {
            const fileData = await downloadFile(audioStoragePath);
            if (isValidMp3(fileData)) continue;

            const repaired = await tryRepairAudio(fileData, audio, tempDir);
            if (repaired && repaired.length > 0 && isValidMp3(repaired)) {
              await uploadFile(audioStoragePath, repaired, 'audio/mpeg');
              report.repaired.push(`audio/${audio}`);
            } else {
              try {
                await supabase.storage.from('uploads').remove([audioStoragePath]);
              } catch {}
              report.removed.push(`audio/${audio}`);
            }
          } catch (err) {
            console.error(`Error downloading audio ${audio}:`, err);
          }
        }
      } catch {}

      // Réparer les vidéos
      const videoFolder = `${storagePrefix}/video`;
      try {
        const videos = await listFiles(videoFolder);
        for (const video of videos) {
          if (!video.toLowerCase().endsWith('.mp4')) continue;

          const videoStoragePath = `${videoFolder}/${video}`;
          try {
            const fileData = await downloadFile(videoStoragePath);
            if (isValidMp4(fileData)) continue;

            const repaired = await tryRepairVideo(fileData, video, tempDir);
            if (repaired && repaired.length > 0 && isValidMp4(repaired)) {
              await uploadFile(videoStoragePath, repaired, 'video/mp4');
              report.repaired.push(`video/${video}`);
            } else {
              try {
                await supabase.storage.from('uploads').remove([videoStoragePath]);
              } catch {}
              report.removed.push(`video/${video}`);
            }
          } catch (err) {
            console.error(`Error downloading video ${video}:`, err);
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

            const tmpIn = path.join(tempDir, `resp_in_${resp}`);
            const tmpOut = path.join(tempDir, `resp_out_${resp.replace(/\.[^.]+$/, '.webp')}`);
            try {
              await writeFile(tmpIn, fileData);
              await sharp(tmpIn)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 75 })
                .toFile(tmpOut);
              const outData = await readFile(tmpOut);
              if (outData.length > 0 && isValidImage(outData)) {
                const newRespName = resp.replace(/\.[^.]+$/, '.webp');
                const newStoragePath = `${responsesFolder}/${newRespName}`;
                await uploadFile(newStoragePath, outData, 'image/webp');
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
            } finally {
              await unlink(tmpIn).catch(() => {});
              await unlink(tmpOut).catch(() => {});
            }
          } catch (err) {
            console.error(`Error downloading response ${resp}:`, err);
          }
        }
      } catch {}

      // Cleanup temp
      try {
        await rm(tempDir, { recursive: true, force: true });
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
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {}
      throw error;
    }
  } catch (error) {
    console.error('Series repair error:', error);
    return NextResponse.json({ error: 'Réparation échouée: ' + (error as Error).message }, { status: 500 });
  }
}

// === Réparation Audio MP3 ===
async function tryRepairAudio(fileData: Buffer, baseName: string, tempDir: string): Promise<Buffer | null> {
  const tmpIn = path.join(tempDir, `repair_audio_in_${baseName}`);
  const tmpOut = path.join(tempDir, `repair_audio_out_${baseName}`);

  try {
    await writeFile(tmpIn, fileData);

    // Strategy 1: Re-encode with error tolerance
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
    } catch {}

    // Strategy 2: Force mp3 format
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
    } catch {}

    // Strategy 3: WAV intermédiaire
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

    await cleanupFiles(tmpIn, tmpOut);
    return null;
  } catch {
    await cleanupFiles(tmpIn, tmpOut);
    return null;
  }
}

// === Réparation Vidéo MP4 ===
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
  for (const f of files) await unlink(f).catch(() => {});
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
