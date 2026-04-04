import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toSupabaseUrl } from '@/lib/supabase';

// GET /api/questions/melange?category=A - Get mixed questions
// B: 40 from B | A/C/D/E: 36 from B + 10 from category
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');

  if (!categoryCode) {
    return NextResponse.json({ error: 'Missing category' }, { status: 400 });
  }

  try {
    const questions: any[] = [];

    if (categoryCode === 'B') {
      // Catégorie B: 40 questions aléatoires de toutes les séries B
      const categoryB = await db.category.findUnique({
        where: { code: 'B' },
        include: {
          series: {
            include: {
              questions: {
                include: {
                  responses: { orderBy: { order: 'asc' } },
                },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { number: 'asc' },
          },
        },
      });

      if (categoryB) {
        const allQuestions = categoryB.series.flatMap(s =>
          s.questions.map(q => ({
            id: q.id,
            order: q.order,
            image: toSupabaseUrl(q.image),
            audio: toSupabaseUrl(q.audio),
            video: toSupabaseUrl(q.video),
            duration: q.duration,
            responses: q.responses.map(r => ({
              id: r.id,
              order: r.order,
              text: r.text,
              image: toSupabaseUrl(r.image),
              isCorrect: r.isCorrect,
            })),
          }))
        );
        // Shuffle et prendre 40
        shuffleArray(allQuestions);
        questions.push(...allQuestions.slice(0, 40));
      }
    } else {
      // A/C/D/E: 36 de B + 10 de la catégorie
      const [categoryB, categoryOther] = await Promise.all([
        db.category.findUnique({
          where: { code: 'B' },
          include: {
            series: {
              include: {
                questions: {
                  include: {
                    responses: { orderBy: { order: 'asc' } },
                  },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { number: 'asc' },
            },
          },
        }),
        db.category.findUnique({
          where: { code: categoryCode },
          include: {
            series: {
              include: {
                questions: {
                  include: {
                    responses: { orderBy: { order: 'asc' } },
                  },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { number: 'asc' },
            },
          },
        }),
      ]);

      const allBQuestions = categoryB
        ? categoryB.series.flatMap(s =>
            s.questions.map(q => ({
              id: q.id,
              order: q.order,
              image: toSupabaseUrl(q.image),
              audio: toSupabaseUrl(q.audio),
              video: toSupabaseUrl(q.video),
              duration: q.duration,
              responses: q.responses.map(r => ({
                id: r.id,
                order: r.order,
                text: r.text,
                image: toSupabaseUrl(r.image),
                isCorrect: r.isCorrect,
              })),
            }))
          )
        : [];

      const allOtherQuestions = categoryOther
        ? categoryOther.series.flatMap(s =>
            s.questions.map(q => ({
              id: q.id,
              order: q.order,
              image: toSupabaseUrl(q.image),
              audio: toSupabaseUrl(q.audio),
              video: toSupabaseUrl(q.video),
              duration: q.duration,
              responses: q.responses.map(r => ({
                id: r.id,
                order: r.order,
                text: r.text,
                image: toSupabaseUrl(r.image),
                isCorrect: r.isCorrect,
              })),
            }))
          )
        : [];

      // Shuffle B, prendre 36
      shuffleArray(allBQuestions);
      const selectedB = allBQuestions.slice(0, 36);

      // Shuffle other, prendre 10
      shuffleArray(allOtherQuestions);
      const selectedOther = allOtherQuestions.slice(0, 10);

      // Combiner et reshuffle final
      const combined = [...selectedB, ...selectedOther];
      shuffleArray(combined);
      questions.push(...combined);
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error fetching melange questions:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
