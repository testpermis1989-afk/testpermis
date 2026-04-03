import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, mkdir, unlink, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';

// GET /api/admin/compress - Get file stats for a serie
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber);
    if (!existsSync(uploadDir)) {
      return NextResponse.json({ error: 'Série non trouvée' }, { status: 404 });
    }

    const stats = {
      images: { count: 0, totalSize: 0 },
      audio: { count: 0, totalSize: 0 },
      video: { count: 0, totalSize: 0 },
      responses: { count: 0, totalSize: 0 },
    };

    for (const [subDir] of [['images'], ['audio'], ['video'], ['responses']] as const) {
      const dir = path.join(uploadDir, subDir);
      if (!existsSync(dir)) continue;
      const files = await readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const fileStat = await stat(filePath);
        if (fileStat.isFile()) {
          (stats[subDir] as { count: number; totalSize: number }).count++;
          (stats[subDir] as { count: number; totalSize: number }).totalSize += fileStat.size;
        }
      }
    }

    const totalSize = stats.images.totalSize + stats.audio.totalSize + stats.video.totalSize + stats.responses.totalSize;

    return NextResponse.json({ stats, totalSize });
  } catch (error) {
    console.error('Error getting stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}

// POST /api/admin/compress - Compress files in place
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  const jobId = randomUUID();
  const tempDir = path.join(process.cwd(), 'public', 'uploads', '_temp_compress', jobId);

  try {
    await mkdir(tempDir, { recursive: true });

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber);
    if (!existsSync(uploadDir)) {
      return NextResponse.json({ error: 'Série non trouvée' }, { status: 404 });
    }

    // Taille avant
    const beforeResult = await getSize(uploadDir);

    const result = {
      images: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
      audio: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
      video: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
      responses: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
    };

    // 1. Compress images → WebP max 1024px, qualité 75%
    const imagesDir = path.join(uploadDir, 'images');
    const outImagesDir = path.join(tempDir, 'images');
    if (existsSync(imagesDir)) {
      await mkdir(outImagesDir, { recursive: true });
      const files = await readdir(imagesDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'].includes(ext)) continue;
        const inputPath = path.join(imagesDir, file);
        const originalSize = (await stat(inputPath)).size;
        const outName = file.replace(/\.[^.]+$/, '.webp');
        const outputPath = path.join(outImagesDir, outName);

        try {
          await sharp(inputPath)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 75 })
            .toFile(outputPath);
          const newSize = (await stat(outputPath)).size;
          result.images.compressed++;
          result.images.beforeBytes += originalSize;
          result.images.afterBytes += newSize;
        } catch {
          // Copier original si échec
          const buf = await readFile(inputPath);
          await writeFile(path.join(outImagesDir, file), buf);
          result.images.compressed++;
          result.images.beforeBytes += originalSize;
          result.images.afterBytes += originalSize;
        }
      }
    }

    // 2. Compress response images
    const responsesDir = path.join(uploadDir, 'responses');
    const outResponsesDir = path.join(tempDir, 'responses');
    if (existsSync(responsesDir)) {
      await mkdir(outResponsesDir, { recursive: true });
      const files = await readdir(responsesDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'].includes(ext)) continue;
        const inputPath = path.join(responsesDir, file);
        const originalSize = (await stat(inputPath)).size;
        const outName = file.replace(/\.[^.]+$/, '.webp');
        const outputPath = path.join(outResponsesDir, outName);

        try {
          await sharp(inputPath)
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 75 })
            .toFile(outputPath);
          const newSize = (await stat(outputPath)).size;
          result.responses.compressed++;
          result.responses.beforeBytes += originalSize;
          result.responses.afterBytes += newSize;
        } catch {
          const buf = await readFile(inputPath);
          await writeFile(path.join(outResponsesDir, file), buf);
          result.responses.compressed++;
          result.responses.beforeBytes += originalSize;
          result.responses.afterBytes += originalSize;
        }
      }
    }

    // 3. Compress audio → 64kbps mono MP3
    const audioDir = path.join(uploadDir, 'audio');
    const outAudioDir = path.join(tempDir, 'audio');
    if (existsSync(audioDir)) {
      await mkdir(outAudioDir, { recursive: true });
      const files = await readdir(audioDir);
      for (const file of files) {
        if (!file.endsWith('.mp3')) continue;
        const inputPath = path.join(audioDir, file);
        const originalSize = (await stat(inputPath)).size;
        const outputPath = path.join(outAudioDir, file);

        try {
          await new Promise<void>((resolve, reject) => {
            ffmpeg(inputPath)
              .audioBitrate('64k')
              .audioChannels(1)
              .output(outputPath)
              .on('end', resolve)
              .on('error', reject)
              .run();
          });
          const newSize = (await stat(outputPath)).size;
          result.audio.compressed++;
          result.audio.beforeBytes += originalSize;
          result.audio.afterBytes += newSize;
        } catch {
          const buf = await readFile(inputPath);
          await writeFile(outputPath, buf);
          result.audio.compressed++;
          result.audio.beforeBytes += originalSize;
          result.audio.afterBytes += originalSize;
        }
      }
    }

    // 4. Compress vidéo → 480p, 500kbps
    const videoDir = path.join(uploadDir, 'video');
    const outVideoDir = path.join(tempDir, 'video');
    if (existsSync(videoDir)) {
      await mkdir(outVideoDir, { recursive: true });
      const files = await readdir(videoDir);
      for (const file of files) {
        if (!file.endsWith('.mp4')) continue;
        const inputPath = path.join(videoDir, file);
        const originalSize = (await stat(inputPath)).size;
        const outputPath = path.join(outVideoDir, file);

        try {
          await new Promise<void>((resolve, reject) => {
            ffmpeg(inputPath)
              .size('854x480')
              .videoBitrate('500k')
              .audioBitrate('64k')
              .output(outputPath)
              .on('end', resolve)
              .on('error', reject)
              .run();
          });
          const newSize = (await stat(outputPath)).size;
          result.video.compressed++;
          result.video.beforeBytes += originalSize;
          result.video.afterBytes += newSize;
        } catch {
          const buf = await readFile(inputPath);
          await writeFile(outputPath, buf);
          result.video.compressed++;
          result.video.beforeBytes += originalSize;
          result.video.afterBytes += originalSize;
        }
      }
    }

    // 5. Remplacer les fichiers originaux par les compressés
    const dirsToReplace: { src: string; dst: string }[] = [
      { src: outImagesDir, dst: path.join(uploadDir, 'images') },
      { src: outResponsesDir, dst: path.join(uploadDir, 'responses') },
      { src: outAudioDir, dst: path.join(uploadDir, 'audio') },
      { src: outVideoDir, dst: path.join(uploadDir, 'video') },
    ];

    for (const { src, dst } of dirsToReplace) {
      if (!existsSync(src)) continue;
      // Supprimer anciens fichiers
      if (existsSync(dst)) {
        const oldFiles = await readdir(dst);
        for (const oldFile of oldFiles) await unlink(path.join(dst, oldFile));
      } else {
        await mkdir(dst, { recursive: true });
      }
      // Copier nouveaux
      const newFiles = await readdir(src);
      for (const newFile of newFiles) {
        await writeFile(path.join(dst, newFile), await readFile(path.join(src, newFile)));
      }
    }

    // 6. Nettoyer temp
    for (const { src } of dirsToReplace) {
      if (!existsSync(src)) continue;
      const files = await readdir(src);
      for (const f of files) await unlink(path.join(src, f));
      await unlink(src);
    }
    await unlink(tempDir);

    // 7. Mettre à jour les chemins dans la base de données directement
    try {
      const category = await db.category.findUnique({ where: { code: categoryCode } });
      if (category) {
        const serie = await db.serie.findFirst({ where: { categoryId: category.id, number: parseInt(serieNumber) } });
        if (serie) {
          const questions = await db.question.findMany({ where: { serieId: serie.id } });

          for (const q of questions) {
            const update: { image?: string; audio?: string; text?: string; video?: string } = {};

            // Fix image path
            if (q.image) {
              const fixed = await findNewPath(uploadDir, 'images', q.image, q.order, ['q', '']);
              if (fixed && fixed !== q.image) update.image = fixed;
              else if (!fileExists(q.image)) update.image = '';
            }

            // Fix audio path (audio reste mp3, pas d'extension change)
            if (q.audio && !fileExists(q.audio)) {
              const audioDir = path.join(uploadDir, 'audio');
              const found = await findExistingFile(audioDir, q.order, ['q', ''], ['mp3']);
              update.audio = found || '';
            }

            // Fix response image (text field)
            if (q.text) {
              const fixed = await findNewPath(uploadDir, 'responses', q.text, q.order, ['r', 'R']);
              if (fixed && fixed !== q.text) update.text = fixed;
              else if (!fileExists(q.text)) update.text = '';
            }

            // Fix video path
            if (q.video && !fileExists(q.video)) {
              const videoDir = path.join(uploadDir, 'video');
              const found = await findExistingFile(videoDir, q.order, ['q', ''], ['mp4']);
              update.video = found || null;
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

    // Taille après
    const afterResult = await getSize(uploadDir);

    const totalBefore = result.images.beforeBytes + result.audio.beforeBytes + result.video.beforeBytes + result.responses.beforeBytes;
    const totalAfter = result.images.afterBytes + result.audio.afterBytes + result.video.afterBytes + result.responses.afterBytes;
    const totalSaved = totalBefore - totalAfter;

    return NextResponse.json({
      success: true,
      result,
      beforeSize: beforeResult,
      afterSize: afterResult,
      totalSaved,
    });
  } catch (error) {
    console.error('Compression error:', error);
    // Cleanup
    try {
      if (existsSync(tempDir)) {
        const { rm } = await import('fs/promises');
        await rm(tempDir, { recursive: true, force: true });
      }
    } catch {}
    return NextResponse.json({ error: 'Compression failed: ' + (error as Error).message }, { status: 500 });
  }
}

async function getSize(uploadDir: string): Promise<number> {
  let total = 0;
  for (const subDir of ['images', 'audio', 'video', 'responses']) {
    const dir = path.join(uploadDir, subDir);
    if (!existsSync(dir)) continue;
    const files = await readdir(dir);
    for (const file of files) {
      try { total += (await stat(path.join(dir, file))).size; } catch {}
    }
  }
  return total;
}

function fileExists(urlPath: string): boolean {
  return existsSync(path.join(process.cwd(), 'public', urlPath));
}

// Trouver le nouveau chemin d'un fichier après compression (ex: q1.png → q1.webp)
async function findNewPath(uploadDir: string, subDir: string, oldUrlPath: string, questionNum: number, prefixes: string[]): Promise<string | null> {
  const dir = path.join(uploadDir, subDir);
  if (!existsSync(dir)) return null;

  try {
    const files = await readdir(dir);
    const num = questionNum;
    const imageExts = ['webp', 'png', 'jpg', 'jpeg', 'gif'];

    // Essayer chaque prefix avec chaque extension
    for (const prefix of prefixes) {
      const baseName = prefix ? `${prefix}${num}` : `${num}`;
      for (const ext of imageExts) {
        const target = `${baseName}.${ext}`;
        const match = files.find(f => f.toLowerCase() === target.toLowerCase());
        if (match) {
          return `/uploads/${path.basename(uploadDir)}/${subDir}/${match}`;
        }
      }
    }
  } catch {}
  return null;
}

// Trouver un fichier existant par numéro de question
async function findExistingFile(dir: string, questionNum: number, prefixes: string[], exts: string[]): Promise<string | null> {
  if (!existsSync(dir)) return null;
  try {
    const files = await readdir(dir);
    const num = questionNum;
    for (const prefix of prefixes) {
      const baseName = prefix ? `${prefix}${num}` : `${num}`;
      for (const ext of exts) {
        const target = `${baseName}.${ext}`;
        const match = files.find(f => f.toLowerCase() === target.toLowerCase());
        if (match) {
          // Construire le chemin URL relatif
          const parts = dir.split('/').slice(-3); // uploads/cat/serie/audio ou images
          return `/${parts.join('/')}/${match}`;
        }
      }
    }
  } catch {}
  return null;
}
