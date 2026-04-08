import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { deleteSerie } from '@/lib/series-file';

// DELETE /api/questions/delete - Delete a serie (JSON file + DB + local files)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  try {
    // 1. Delete from JSON file (primary storage)
    const jsonDeleted = deleteSerie(categoryCode, parseInt(serieNumber));
    console.log(`[Delete] JSON file: ${jsonDeleted ? 'deleted' : 'not found'} for ${categoryCode}/${serieNumber}`);

    // 2. Try to delete from DB (secondary)
    try {
      const { db } = await import('@/lib/db');
      const category = await db.category.findUnique({
        where: { code: categoryCode },
        include: { series: { where: { number: parseInt(serieNumber) } } },
      });

      if (category && category.series.length > 0) {
        const serie = category.series[0];
        try { await db.response.deleteMany({ where: { question: { serieId: serie.id } } }); } catch {}
        try { await db.question.deleteMany({ where: { serieId: serie.id } }); } catch {}
        try { await db.serie.delete({ where: { id: serie.id } }); } catch {}
        console.log(`[Delete] DB: deleted for ${categoryCode}/${serieNumber}`);
      }
    } catch (dbErr) {
      console.log('[Delete] DB delete failed (JSON file already deleted):', dbErr);
    }

    // 3. Delete local files
    const dataDir = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
    const seriesDir = path.join(dataDir, 'uploads', `series/${categoryCode}/${serieNumber}`);

    try {
      if (fs.existsSync(seriesDir)) {
        fs.rmSync(seriesDir, { recursive: true, force: true });
        console.log(`[Delete] Files: deleted ${seriesDir}`);
      }
    } catch (fileErr) {
      console.warn('[Delete] Failed to delete local files:', fileErr);
    }

    return NextResponse.json({ success: true, message: `Série ${categoryCode}/${serieNumber} supprimée` });
  } catch (error) {
    console.error('Error deleting serie:', error);
    return NextResponse.json({ error: 'Failed to delete serie' }, { status: 500 });
  }
}
