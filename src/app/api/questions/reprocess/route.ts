import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { existsSync, readdirSync } from 'fs';
import path from 'path';

// POST /api/questions/reprocess - Rescan files and fix missing paths in DB
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('category');
    const serieNumber = searchParams.get('serie');

    if (!categoryCode || !serieNumber) {
      // Reprocess all series
      const categories = await db.category.findMany();
      let totalFixed = 0;
      const results: { category: string; serie: number; fixed: number }[] = [];

      for (const cat of categories) {
        const series = await db.serie.findMany({ where: { categoryId: cat.id } });
        for (const s of series) {
          const fixed = await reprocessSerie(cat.code, s.number);
          if (fixed > 0) {
            results.push({ category: cat.code, serie: s.number, fixed });
            totalFixed += fixed;
          }
        }
      }

      return NextResponse.json({ success: true, totalFixed, results });
    }

    const fixed = await reprocessSerie(categoryCode, parseInt(serieNumber));
    return NextResponse.json({ success: true, category: categoryCode, serie: serieNumber, fixed });
  } catch (error) {
    console.error('Reprocess error:', error);
    return NextResponse.json({ error: 'Reprocess failed' }, { status: 500 });
  }
}

async function reprocessSerie(categoryCode: string, serieNumber: number): Promise<number> {
  const category = await db.category.findUnique({ where: { code: categoryCode } });
  if (!category) return 0;

  const serie = await db.serie.findFirst({ where: { categoryId: category.id, number: serieNumber } });
  if (!serie) return 0;

  const questions = await db.question.findMany({ where: { serieId: serie.id }, orderBy: { order: 'asc' } });
  let fixed = 0;

  for (const q of questions) {
    const num = q.order;
    const updateData: { image?: string; audio?: string; text?: string; video?: string } = {};

    // Fix image
    const imgPath = findFile(categoryCode, serieNumber, 'images', num, ['q' + num, String(num)]);
    if (imgPath && (!q.image || !fileExists(q.image))) {
      updateData.image = imgPath;
    }

    // Fix audio
    const audioPath = findFile(categoryCode, serieNumber, 'audio', num, ['q' + num, String(num)], ['mp3']);
    if (audioPath && (!q.audio || !fileExists(q.audio))) {
      updateData.audio = audioPath;
    }

    // Fix response image
    const respPath = findFile(categoryCode, serieNumber, 'responses', num, ['r' + num, 'R' + num, String(num)]);
    if (respPath && (!q.text || !fileExists(q.text))) {
      updateData.text = respPath;
    }

    // Fix video
    const videoPath = findFile(categoryCode, serieNumber, 'video', num, ['q' + num, String(num)], ['mp4']);
    if (videoPath && (!q.video || !fileExists(q.video))) {
      updateData.video = videoPath;
    }

    if (Object.keys(updateData).length > 0) {
      await db.question.update({ where: { id: q.id }, data: updateData });
      fixed++;
    }
  }

  return fixed;
}

function findFile(categoryCode: string, serieNumber: number, subDir: string, num: number, prefixes: string[], exts?: string[]): string | null {
  const dir = path.join(process.cwd(), 'public', 'uploads', categoryCode, String(serieNumber), subDir);
  if (!existsSync(dir)) return null;

  const defaultExts = exts || ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  try {
    const files = readdirSync(dir);
    for (const prefix of prefixes) {
      for (const ext of defaultExts) {
        const fileName = `${prefix}.${ext}`;
        if (files.some(f => f.toLowerCase() === fileName.toLowerCase())) {
          const actualFile = files.find(f => f.toLowerCase() === fileName.toLowerCase());
          return `/uploads/${categoryCode}/${serieNumber}/${subDir}/${actualFile}`;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function fileExists(urlPath: string): boolean {
  const filePath = path.join(process.cwd(), 'public', urlPath);
  return existsSync(filePath);
}
