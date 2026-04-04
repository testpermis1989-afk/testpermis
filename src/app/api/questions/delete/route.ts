import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deleteFolder } from '@/lib/supabase';

// DELETE /api/questions/delete - Delete a serie (DB + Supabase Storage files)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  try {
    const category = await db.category.findUnique({
      where: { code: categoryCode },
      include: {
        series: {
          where: { number: parseInt(serieNumber) },
        },
      },
    });

    if (!category || category.series.length === 0) {
      return NextResponse.json({ error: 'Serie not found' }, { status: 404 });
    }

    const serie = category.series[0];

    // Delete responses first
    await db.response.deleteMany({
      where: {
        question: { serieId: serie.id },
      },
    });

    // Delete questions
    await db.question.deleteMany({
      where: { serieId: serie.id },
    });

    // Delete serie
    await db.serie.delete({
      where: { id: serie.id },
    });

    // Delete files from Supabase Storage
    const storagePrefix = `series/${categoryCode}/${serieNumber}`;
    const subDirs = ['images', 'audio', 'video', 'responses'];
    for (const subDir of subDirs) {
      try {
        await deleteFolder(`${storagePrefix}/${subDir}`);
      } catch (err) {
        console.error(`Failed to delete ${storagePrefix}/${subDir}:`, err);
      }
    }

    return NextResponse.json({ success: true, message: `Série ${categoryCode}/${serieNumber} supprimée (DB + fichiers)` });
  } catch (error) {
    console.error('Error deleting serie:', error);
    return NextResponse.json({ error: 'Failed to delete serie' }, { status: 500 });
  }
}
