import { NextRequest, NextResponse } from 'next/server';
import { getSerieQuestions } from '@/lib/series-file';

// GET /api/questions/melange?category=A - Get mixed questions
// B: 40 from B | A/C/D/E: 36 from B + 10 from category
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');

  if (!categoryCode) {
    return NextResponse.json({ error: 'Missing category' }, { status: 400 });
  }

  try {
    // PRIMARY: Read from JSON file
    const questions = await getMelangeFromJson(categoryCode);
    if (questions.length > 0) {
      return NextResponse.json({ questions });
    }

    // SECONDARY: Try database
    const questionsFromDb = await getMelangeFromDb(categoryCode);
    if (questionsFromDb.length > 0) {
      return NextResponse.json({ questions: questionsFromDb });
    }

    return NextResponse.json({ questions: [], error: 'Aucune question trouvée. Importez des séries d\'abord.' });
  } catch (error) {
    console.error('Error fetching melange questions:', error);
    return NextResponse.json({ questions: [], error: 'Failed to fetch questions' });
  }
}

// Get melange questions from JSON file
function getMelangeFromJson(categoryCode: string): any[] {
  const { readSeriesFile } = require('@/lib/series-file');
  const data = readSeriesFile();
  const allQuestions: any[] = [];

  const collectQuestions = (code: string, count: number) => {
    const seriesForCat = Object.entries(data.series).filter(([, s]) => s.categoryCode === code);
    for (const [key] of seriesForCat) {
      const qList = data.questions[key] || [];
      for (const q of qList) {
        allQuestions.push({
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
        });
      }
    }
    shuffleArray(allQuestions);
    return allQuestions.splice(0, count);
  };

  if (categoryCode === 'B') {
    // B: 40 random from B
    collectQuestions('B', 40);
  } else {
    // A/C/D/E: 36 from B + 10 from category
    const bQuestions: any[] = [];
    const bSeries = Object.entries(data.series).filter(([, s]) => s.categoryCode === 'B');
    for (const [key] of bSeries) {
      const qList = data.questions[key] || [];
      for (const q of qList) {
        bQuestions.push({
          id: q.id, order: q.order, image: q.image || '', audio: q.audio || '',
          video: q.video || '', duration: q.duration || 30,
          responses: (q.responses || []).map((r: any) => ({
            id: r.id, order: r.order, text: r.text || '', image: r.image || '', isCorrect: !!r.isCorrect,
          })),
        });
      }
    }
    shuffleArray(bQuestions);
    allQuestions.push(...bQuestions.slice(0, 36));

    const otherQuestions: any[] = [];
    const otherSeries = Object.entries(data.series).filter(([, s]) => s.categoryCode === categoryCode);
    for (const [key] of otherSeries) {
      const qList = data.questions[key] || [];
      for (const q of qList) {
        otherQuestions.push({
          id: q.id, order: q.order, image: q.image || '', audio: q.audio || '',
          video: q.video || '', duration: q.duration || 30,
          responses: (q.responses || []).map((r: any) => ({
            id: r.id, order: r.order, text: r.text || '', image: r.image || '', isCorrect: !!r.isCorrect,
          })),
        });
      }
    }
    shuffleArray(otherQuestions);
    allQuestions.push(...otherQuestions.slice(0, 10));
  }

  shuffleArray(allQuestions);
  return allQuestions;
}

// Get melange questions from database (fallback)
async function getMelangeFromDb(categoryCode: string): Promise<any[]> {
  try {
    const { db } = await import('@/lib/db');
    const questions: any[] = [];

    if (categoryCode === 'B') {
      const categoryB = await db.category.findUnique({
        where: { code: 'B' },
        include: {
          series: {
            include: { questions: { include: { responses: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
            orderBy: { number: 'asc' },
          },
        },
      });
      if (categoryB) {
        const allQuestions = categoryB.series.flatMap((s: any) =>
          s.questions.map((q: any) => ({
            id: q.id, order: q.order, image: q.image || '', audio: q.audio || '',
            video: q.video || '', duration: q.duration || 30,
            responses: q.responses.map((r: any) => ({
              id: r.id, order: r.order, text: r.text || '', image: r.image || '', isCorrect: !!r.isCorrect,
            })),
          }))
        );
        shuffleArray(allQuestions);
        questions.push(...allQuestions.slice(0, 40));
      }
    } else {
      const [categoryB, categoryOther] = await Promise.all([
        db.category.findUnique({
          where: { code: 'B' },
          include: {
            series: {
              include: { questions: { include: { responses: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
              orderBy: { number: 'asc' },
            },
          },
        }),
        db.category.findUnique({
          where: { code: categoryCode },
          include: {
            series: {
              include: { questions: { include: { responses: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
              orderBy: { number: 'asc' },
            },
          },
        }),
      ]);

      const allB = categoryB ? (categoryB as any).series.flatMap((s: any) =>
        s.questions.map((q: any) => ({
          id: q.id, order: q.order, image: q.image || '', audio: q.audio || '',
          video: q.video || '', duration: q.duration || 30,
          responses: q.responses.map((r: any) => ({
            id: r.id, order: r.order, text: r.text || '', image: r.image || '', isCorrect: !!r.isCorrect,
          })),
        }))
      ) : [];

      const allOther = categoryOther ? (categoryOther as any).series.flatMap((s: any) =>
        s.questions.map((q: any) => ({
          id: q.id, order: q.order, image: q.image || '', audio: q.audio || '',
          video: q.video || '', duration: q.duration || 30,
          responses: q.responses.map((r: any) => ({
            id: r.id, order: r.order, text: r.text || '', image: r.image || '', isCorrect: !!r.isCorrect,
          })),
        }))
      ) : [];

      shuffleArray(allB);
      shuffleArray(allOther);
      questions.push(...allB.slice(0, 36));
      questions.push(...allOther.slice(0, 10));
    }

    shuffleArray(questions);
    return questions;
  } catch {
    return [];
  }
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
