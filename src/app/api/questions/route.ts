import { NextRequest, NextResponse } from 'next/server';

// GET /api/questions - Get questions for a serie
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  try {
    const { db } = await import('@/lib/db');

    const category = await db.category.findUnique({
      where: { code: categoryCode },
      include: {
        series: {
          where: { number: parseInt(serieNumber) },
          _includeQuestions: true,
        },
      },
    });

    if (!category || !category.series || (category.series as any[]).length === 0) {
      return NextResponse.json({ error: 'Serie not found', questions: [] });
    }

    const serie = (category.series as any[])[0];
    const questions = (serie.questions || []).map((q: any) => ({
      id: q.id,
      order: q.order,
      image: q.image || '',
      audio: q.audio || '',
      video: q.video || '',
      duration: q.duration || 30,
      responses: (q.responses || []).map((r: any) => ({
        id: r.id,
        order: r.order,
        text: r.text || '',
        image: r.image || '',
        isCorrect: !!r.isCorrect,
      })),
    }));

    return NextResponse.json({
      category: {
        code: category.code,
        name: category.name,
        nameAr: category.nameAr,
      },
      serie: {
        number: serie.number,
        questionsCount: serie.questionsCount,
      },
      questions,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
