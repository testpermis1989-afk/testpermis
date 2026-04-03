import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, mkdir, unlink, readFile, writeFile, cp } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

// POST /api/series/repair - Réparer les fichiers corrompus d'une série existante
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, serie } = body;

    if (!category || !serie) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const seriePath = path.join(process.cwd(), 'public', 'uploads', category, String(serie));
    if (!existsSync(seriePath)) {
      return NextResponse.json({ error: `Série ${category}/${serie} introuvable` }, { status: 404 });
    }

    const tempDir = path.join(process.cwd(), 'public', 'uploads', '_temp_repair', `${category}_${serie}_${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    try {
      const report = {
        repaired: [] as string[],
        removed: [] as string[],
        errors: [] as string[],
      };

      // Réparer les images
      const imagesDir = path.join(seriePath, 'images');
      if (existsSync(imagesDir)) {
        const images = await readdir(imagesDir);
        for (const img of images) {
          const ext = path.extname(img).toLowerCase();
          if (!['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.webp'].includes(ext)) continue;

          const imgPath = path.join(imagesDir, img);
          const fileData = await readFile(imgPath);

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
              if (newImgName !== img) {
                await unlink(imgPath).catch(() => {});
              }
              await writeFile(path.join(imagesDir, newImgName), outData);
              report.repaired.push(`images/${img} → ${newImgName}`);
            } else {
              await unlink(imgPath);
              report.removed.push(`images/${img}`);
            }
          } catch {
            await unlink(imgPath);
            report.removed.push(`images/${img}`);
          } finally {
            await unlink(tmpIn).catch(() => {});
            await unlink(tmpOut).catch(() => {});
          }
        }
      }

      // Réparer les audios
      const audioDir = path.join(seriePath, 'audio');
      if (existsSync(audioDir)) {
        const audios = await readdir(audioDir);
        for (const audio of audios) {
          if (!audio.toLowerCase().endsWith('.mp3')) continue;

          const audioPath = path.join(audioDir, audio);
          const fileData = await readFile(audioPath);

          if (isValidMp3(fileData)) continue; // Déjà valide

          const repaired = await tryRepairAudio(fileData, audio, tempDir);
          if (repaired && repaired.length > 0 && isValidMp3(repaired)) {
            await writeFile(audioPath, repaired);
            report.repaired.push(`audio/${audio}`);
          } else {
            await unlink(audioPath);
            report.removed.push(`audio/${audio}`);
          }
        }
      }

      // Réparer les vidéos
      const videoDir = path.join(seriePath, 'video');
      if (existsSync(videoDir)) {
        const videos = await readdir(videoDir);
        for (const video of videos) {
          if (!video.toLowerCase().endsWith('.mp4')) continue;

          const videoPath = path.join(videoDir, video);
          const fileData = await readFile(videoPath);

          if (isValidMp4(fileData)) continue; // Déjà valide

          const repaired = await tryRepairVideo(fileData, video, tempDir);
          if (repaired && repaired.length > 0 && isValidMp4(repaired)) {
            await writeFile(videoPath, repaired);
            report.repaired.push(`video/${video}`);
          } else {
            await unlink(videoPath);
            report.removed.push(`video/${video}`);
          }
        }
      }

      // Réparer les images de réponses
      const responsesDir = path.join(seriePath, 'responses');
      if (existsSync(responsesDir)) {
        const responses = await readdir(responsesDir);
        for (const resp of responses) {
          const ext = path.extname(resp).toLowerCase();
          if (!['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.webp'].includes(ext)) continue;

          const respPath = path.join(responsesDir, resp);
          const fileData = await readFile(respPath);

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
              if (newRespName !== resp) {
                await unlink(respPath).catch(() => {});
              }
              await writeFile(path.join(responsesDir, newRespName), outData);
              report.repaired.push(`responses/${resp} → ${newRespName}`);
            } else {
              await unlink(respPath);
              report.removed.push(`responses/${resp}`);
            }
          } catch {
            await unlink(respPath);
            report.removed.push(`responses/${resp}`);
          } finally {
            await unlink(tmpIn).catch(() => {});
            await unlink(tmpOut).catch(() => {});
          }
        }
      }

      // Cleanup temp
      try {
        const { rm } = await import('fs/promises');
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
        const { rm } = await import('fs/promises');
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
      if (existsSync(tmpWav)) {
        const wavStat = await stat(tmpWav);
        if (wavStat.size > 1000) {
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
        }
      }
      await unlink(tmpWav).catch(() => {});
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
