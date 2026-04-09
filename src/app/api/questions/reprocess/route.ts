import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabase, getPublicUrl, listFiles } from '@/lib/supabase';

// POST /api/questions/reprocess - Rescan files in Supabase Storage and fix missing paths in DB
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

    // Fix image - check Supabase Storage
    const imgStoragePath = `series/${categoryCode}/${serieNumber}/images`;
    const imgFile = await findFileInStorage(imgStoragePath, num, ['q' + num, String(num)]);
    if (imgFile) {
      const publicUrl = getPublicUrl(imgFile);
      if (publicUrl !== q.image) updateData.image = publicUrl;
    } else if (q.image) {
      // Image path exists in DB but file not found in storage - clear it
      updateData.image = '';
    }

    // Fix audio
    const audioStoragePath = `series/${categoryCode}/${serieNumber}/audio`;
    const audioFile = await findFileInStorage(audioStoragePath, num, ['q' + num, String(num)], ['mp3']);
    if (audioFile) {
      const publicUrl = getPublicUrl(audioFile);
      if (publicUrl !== q.audio) updateData.audio = publicUrl;
    } else if (q.audio) {
      updateData.audio = '';
    }

    // Fix response image (text field)
    const respStoragePath = `series/${categoryCode}/${serieNumber}/responses`;
    const respFile = await findFileInStorage(respStoragePath, num, ['r' + num, 'R' + num, String(num)]);
    if (respFile) {
      const publicUrl = getPublicUrl(respFile);
      if (publicUrl !== q.text) updateData.text = publicUrl;
    } else if (q.text) {
      updateData.text = '';
    }

    // Fix video
    const videoStoragePath = `series/${categoryCode}/${serieNumber}/video`;
    const videoFile = await findFileInStorage(videoStoragePath, num, ['q' + num, String(num)], ['mp4']);
    if (videoFile) {
      const publicUrl = getPublicUrl(videoFile);
      if (publicUrl !== q.video) updateData.video = publicUrl;
    } else if (q.video) {
      updateData.video = null;
    }

    if (Object.keys(updateData).length > 0) {
      await db.question.update({ where: { id: q.id }, data: updateData });
      fixed++;
    }
  }

  return fixed;
}

async function findFileInStorage(folder: string, num: number, prefixes: string[], exts?: string[]): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from('uploads').list(folder);
    if (error || !data || data.length === 0) return null;

    const defaultExts = exts || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];

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
  } catch (err) {
    console.error('Error listing storage files:', err);
  }
  return null;
}
