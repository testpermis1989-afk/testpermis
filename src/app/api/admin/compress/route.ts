import { NextRequest, NextResponse } from 'next/server';
import { mkdir, unlink, readFile, writeFile, rm, stat } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import os from 'os';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { uploadFile, downloadFile, listFiles, getPublicUrl, supabase } from '@/lib/supabase';

// GET /api/admin/compress - Get file stats for a serie from Supabase Storage
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  try {
    const storagePrefix = `series/${categoryCode}/${serieNumber}`;

    const stats = {
      images: { count: 0, totalSize: 0 },
      audio: { count: 0, totalSize: 0 },
      video: { count: 0, totalSize: 0 },
      responses: { count: 0, totalSize: 0 },
    };

    const subDirs = ['images', 'audio', 'video', 'responses'] as const;
    for (const subDir of subDirs) {
      const folder = `${storagePrefix}/${subDir}`;
      try {
        const files = await listFiles(folder);
        for (const file of files) {
          // Get metadata to check size
          try {
            const { data: fileData } = await supabase.storage.from('uploads').list(folder, {
              search: file,
            });
            if (fileData && fileData.length > 0) {
              (stats[subDir] as { count: number; totalSize: number }).count++;
              (stats[subDir] as { count: number; totalSize: number }).totalSize += fileData[0].metadata?.size || 0;
            }
          } catch {}
        }
      } catch {
        // Folder doesn't exist - skip
      }
    }

    const totalSize = stats.images.totalSize + stats.audio.totalSize + stats.video.totalSize + stats.responses.totalSize;

    return NextResponse.json({ stats, totalSize });
  } catch (error) {
    console.error('Error getting stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

// POST /api/admin/compress - Compress files in place (Supabase Storage)
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  const storagePrefix = `series/${categoryCode}/${serieNumber}`;
  const tempDir = path.join(os.tmpdir(), `compress_${randomUUID()}`);

  try {
    await mkdir(tempDir, { recursive: true });

    const result = {
      images: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
      audio: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
      video: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
      responses: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
    };

    // 1. Compress images → WebP max 1024px, qualité 75%
    const imagesFolder = `${storagePrefix}/images`;
    try {
      const files = await listFiles(imagesFolder);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'].includes(ext)) continue;

        const storagePath = `${imagesFolder}/${file}`;
        try {
          const fileData = await downloadFile(storagePath);
          const originalSize = fileData.length;
          const outName = file.replace(/\.[^.]+$/, '.webp');
          const tmpIn = path.join(tempDir, `img_in_${file}`);
          const tmpOut = path.join(tempDir, `img_out_${outName}`);

          try {
            await writeFile(tmpIn, fileData);
            await sharp(tmpIn)
              .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 75 })
              .toFile(tmpOut);
            const outData = await readFile(tmpOut);
            const newSize = outData.length;

            const newStoragePath = `${imagesFolder}/${outName}`;
            await uploadFile(newStoragePath, outData, 'image/webp');

            // Remove old file if name changed
            if (outName !== file) {
              try { await supabase.storage.from('uploads').remove([storagePath]); } catch {}
            }

            result.images.compressed++;
            result.images.beforeBytes += originalSize;
            result.images.afterBytes += newSize;
          } catch {
            // Keep original on failure
          } finally {
            await unlink(tmpIn).catch(() => {});
            await unlink(tmpOut).catch(() => {});
          }
        } catch (err) {
          console.error(`Failed to download image ${file}:`, err);
        }
      }
    } catch {}

    // 2. Compress response images
    const responsesFolder = `${storagePrefix}/responses`;
    try {
      const files = await listFiles(responsesFolder);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'].includes(ext)) continue;

        const storagePath = `${responsesFolder}/${file}`;
        try {
          const fileData = await downloadFile(storagePath);
          const originalSize = fileData.length;
          const outName = file.replace(/\.[^.]+$/, '.webp');
          const tmpIn = path.join(tempDir, `resp_in_${file}`);
          const tmpOut = path.join(tempDir, `resp_out_${outName}`);

          try {
            await writeFile(tmpIn, fileData);
            await sharp(tmpIn)
              .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 75 })
              .toFile(tmpOut);
            const outData = await readFile(tmpOut);
            const newSize = outData.length;

            const newStoragePath = `${responsesFolder}/${outName}`;
            await uploadFile(newStoragePath, outData, 'image/webp');

            if (outName !== file) {
              try { await supabase.storage.from('uploads').remove([storagePath]); } catch {}
            }

            result.responses.compressed++;
            result.responses.beforeBytes += originalSize;
            result.responses.afterBytes += newSize;
          } catch {
            // Keep original on failure
          } finally {
            await unlink(tmpIn).catch(() => {});
            await unlink(tmpOut).catch(() => {});
          }
        } catch (err) {
          console.error(`Failed to download response ${file}:`, err);
        }
      }
    } catch {}

    // 3. Compress audio → 64kbps mono MP3
    const audioFolder = `${storagePrefix}/audio`;
    try {
      const files = await listFiles(audioFolder);
      for (const file of files) {
        if (!file.endsWith('.mp3')) continue;

        const storagePath = `${audioFolder}/${file}`;
        try {
          const fileData = await downloadFile(storagePath);
          const originalSize = fileData.length;
          const tmpIn = path.join(tempDir, `audio_in_${file}`);
          const tmpOut = path.join(tempDir, `audio_out_${file}`);

          try {
            await writeFile(tmpIn, fileData);
            await new Promise<void>((resolve, reject) => {
              ffmpeg(tmpIn)
                .audioBitrate('64k')
                .audioChannels(1)
                .output(tmpOut)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });
            const outData = await readFile(tmpOut);
            const newSize = outData.length;

            await uploadFile(storagePath, outData, 'audio/mpeg');

            result.audio.compressed++;
            result.audio.beforeBytes += originalSize;
            result.audio.afterBytes += newSize;
          } catch {
            // Keep original on failure
          } finally {
            await unlink(tmpIn).catch(() => {});
            await unlink(tmpOut).catch(() => {});
          }
        } catch (err) {
          console.error(`Failed to download audio ${file}:`, err);
        }
      }
    } catch {}

    // 4. Compress vidéo → 480p, 500kbps
    const videoFolder = `${storagePrefix}/video`;
    try {
      const files = await listFiles(videoFolder);
      for (const file of files) {
        if (!file.endsWith('.mp4')) continue;

        const storagePath = `${videoFolder}/${file}`;
        try {
          const fileData = await downloadFile(storagePath);
          const originalSize = fileData.length;
          const tmpIn = path.join(tempDir, `video_in_${file}`);
          const tmpOut = path.join(tempDir, `video_out_${file}`);

          try {
            await writeFile(tmpIn, fileData);
            await new Promise<void>((resolve, reject) => {
              ffmpeg(tmpIn)
                .size('854x480')
                .videoBitrate('500k')
                .audioBitrate('64k')
                .output(tmpOut)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });
            const outData = await readFile(tmpOut);
            const newSize = outData.length;

            await uploadFile(storagePath, outData, 'video/mp4');

            result.video.compressed++;
            result.video.beforeBytes += originalSize;
            result.video.afterBytes += newSize;
          } catch {
            // Keep original on failure
          } finally {
            await unlink(tmpIn).catch(() => {});
            await unlink(tmpOut).catch(() => {});
          }
        } catch (err) {
          console.error(`Failed to download video ${file}:`, err);
        }
      }
    } catch {}

    // 5. Update DB paths to reflect any file name changes (e.g., .png → .webp)
    try {
      const category = await db.category.findUnique({ where: { code: categoryCode } });
      if (category) {
        const serie = await db.serie.findFirst({ where: { categoryId: category.id, number: parseInt(serieNumber) } });
        if (serie) {
          const questions = await db.question.findMany({ where: { serieId: serie.id } });

          for (const q of questions) {
            const update: { image?: string; audio?: string; text?: string; video?: string } = {};

            // Check each path and verify it exists in storage
            const imgFolder = `${storagePrefix}/images`;
            const audioFolder = `${storagePrefix}/audio`;
            const respFolder = `${storagePrefix}/responses`;
            const videoFolder = `${storagePrefix}/video`;

            // Fix image path
            if (q.image) {
              const fixed = await findFileInStorage(imgFolder, q.order, ['q', '']);
              const publicUrl = fixed ? getPublicUrl(fixed) : '';
              if (publicUrl !== q.image) update.image = publicUrl;
            }

            // Fix audio path
            if (q.audio) {
              const fixed = await findFileInStorage(audioFolder, q.order, ['q', ''], ['mp3']);
              const publicUrl = fixed ? getPublicUrl(fixed) : '';
              if (publicUrl !== q.audio) update.audio = publicUrl;
            }

            // Fix response image
            if (q.text) {
              const fixed = await findFileInStorage(respFolder, q.order, ['r', 'R']);
              const publicUrl = fixed ? getPublicUrl(fixed) : '';
              if (publicUrl !== q.text) update.text = publicUrl;
            }

            // Fix video path
            if (q.video) {
              const fixed = await findFileInStorage(videoFolder, q.order, ['q', ''], ['mp4']);
              const publicUrl = fixed ? getPublicUrl(fixed) : null;
              if (publicUrl !== q.video) update.video = publicUrl;
            }

            if (Object.keys(update).length > 0) {
              await db.question.update({ where: { id: q.id }, data: update });
            }
          }
        }
      }
    } catch (dbError) {
      console.error('DB update error after compress:', dbError);
    }

    const totalBefore = result.images.beforeBytes + result.audio.beforeBytes + result.video.beforeBytes + result.responses.beforeBytes;
    const totalAfter = result.images.afterBytes + result.audio.afterBytes + result.video.afterBytes + result.responses.afterBytes;
    const totalSaved = totalBefore - totalAfter;

    return NextResponse.json({
      success: true,
      result,
      totalSaved,
      totalBefore,
      totalAfter,
    });
  } catch (error) {
    console.error('Compression error:', error);
    return NextResponse.json({ error: 'Compression failed: ' + (error as Error).message }, { status: 500 });
  } finally {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

// Find a file in Supabase Storage folder by question number and prefixes
async function findFileInStorage(folder: string, questionNum: number, prefixes: string[], exts?: string[]): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from('uploads').list(folder);
    if (error || !data || data.length === 0) return null;

    const defaultExts = exts || ['webp', 'png', 'jpg', 'jpeg', 'gif'];
    const num = questionNum;

    for (const prefix of prefixes) {
      const baseName = prefix ? `${prefix}${num}` : `${num}`;
      for (const ext of defaultExts) {
        const target = `${baseName}.${ext}`;
        const match = data.find(f => f.name.toLowerCase() === target.toLowerCase());
        if (match) {
          return `${folder}/${match.name}`;
        }
      }
    }
  } catch {}
  return null;
}
