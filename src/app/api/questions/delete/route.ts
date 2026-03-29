import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/questions/delete - Delete a serie and its questions
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

    return NextResponse.json({ success: true, message: `Série ${serieNumber} supprimée` });
  } catch (error) {
    console.error('Error deleting serie:', error);
    return NextResponse.json({ error: 'Failed to delete serie' }, { status: 500 });
  }
}
