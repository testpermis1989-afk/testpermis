import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { getAllCategoriesWithSeries } from '@/lib/series-file';
import { saveSerieQuestions } from '@/lib/series-file';

// Lazy load database - only when needed
async function getDb() {
  const { db } = await import('@/lib/db');
  return db;
}

// Get public URL for media files
function getFileUrl(storagePath: string): string {
  if (!storagePath) return '';
  if (storagePath.startsWith('http')) return storagePath;
  // In local/Electron mode, serve via API
  return `/api/serve/${storagePath}`;
}

// POST /api/questions/import - Import questions from Excel
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const categoryCode = formData.get('category') as string;
    const serieNumber = parseInt(formData.get('serie') as string);

    if (!file || !categoryCode || !serieNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Read Excel file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];

    // Build questions array
    const questions: { order: number; imageUrl: string; audioUrl: string; responseImageUrl?: string; videoUrl?: string | null; correctAnswers: string }[] = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const questionNumber = parseInt(String(row[0]));
      const correctAnswers = String(row[1]);

      if (isNaN(questionNumber)) continue;

      questions.push({
        order: questionNumber,
        imageUrl: `/api/serve/series/${categoryCode}/${serieNumber}/images/q${questionNumber}.png`,
        audioUrl: `/api/serve/series/${categoryCode}/${serieNumber}/audio/q${questionNumber}.mp3`,
        responseImageUrl: `/api/serve/series/${categoryCode}/${serieNumber}/responses/r${questionNumber}.png`,
        correctAnswers,
      });
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No valid questions found in Excel file' }, { status: 400 });
    }

    // PRIMARY: Save to JSON file (always works)
    const jsonResult = saveSerieQuestions(categoryCode, serieNumber, questions);
    console.log(`[Excel Import] Saved ${jsonResult.questionsImported} questions to JSON file`);

    // SECONDARY: Also try to save to DB
    try {
      const db = await getDb();

      // Get or create category
      let category = await db.category.findUnique({ where: { code: categoryCode } });
      if (!category) {
        category = await db.category.create({
          data: {
            code: categoryCode,
            name: getCategoryName(categoryCode),
            nameAr: getCategoryNameAr(categoryCode),
          },
        });
      }

      // Get or create serie
      let serie = await db.serie.findFirst({
        where: { categoryId: category.id, number: serieNumber },
      });
      if (!serie) {
        serie = await db.serie.create({
          data: { categoryId: category.id, number: serieNumber },
        });
      }

      // Clear existing questions in this serie
      const existingQuestions = await db.question.findMany({ where: { serieId: serie.id } });
      if (existingQuestions.length > 0) {
        const qIds = existingQuestions.map((q: any) => q.id);
        for (const qId of qIds) {
          try { await db.response.deleteMany({ where: { questionId: qId } }); } catch { /* ignore */ }
        }
        await db.question.deleteMany({ where: { serieId: serie.id } });
      }

      // Import questions
      let imported = 0;
      for (const q of questions) {
        try {
          const question = await db.question.create({
            data: {
              serieId: serie.id,
              order: q.order,
              image: q.imageUrl,
              audio: q.audioUrl,
              text: `/api/serve/series/${categoryCode}/${serieNumber}/responses/r${q.order}.png`,
            },
          });

          for (let j = 1; j <= 4; j++) {
            await db.response.create({
              data: {
                questionId: question.id,
                order: j,
                text: `Réponse ${j}`,
                isCorrect: q.correctAnswers.includes(String(j)),
              },
            });
          }
          imported++;
        } catch { /* ignore - JSON file has the data */ }
      }

      try {
        await db.serie.update({ where: { id: serie.id }, data: { questionsCount: imported } });
      } catch {}
    } catch (dbErr) {
      console.log('[Excel Import] DB save failed (JSON file is primary):', dbErr);
    }

    return NextResponse.json({
      success: true,
      imported: questions.length,
      category: categoryCode,
      serie: serieNumber,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Import failed: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

// GET /api/questions/import - Get import status (list categories with series)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('category');
    const serieNumber = searchParams.get('serie');

    // PRIMARY: Read from JSON file
    try {
      const jsonResult = getAllCategoriesWithSeries();
      if (jsonResult.categories.length > 0) {
        // If specific category/serie requested, filter
        if (categoryCode) {
          const filtered = jsonResult.categories.filter(c => c.code === categoryCode);
          if (filtered.length > 0) {
            if (serieNumber) {
              const cat = filtered[0];
              const serie = cat.series.find(s => s.number === parseInt(serieNumber));
              return NextResponse.json({ category: { code: cat.code, series: serie ? [serie] : [] } });
            }
            return NextResponse.json({ categories: filtered });
          }
        }
        return NextResponse.json(jsonResult);
      }
    } catch (e) {
      console.log('[/api/questions/import] JSON file read failed:', e);
    }

    // SECONDARY: Try database
    try {
      const db = await getDb();

      if (!categoryCode) {
        const categories = await db.category.findMany({
          include: { series: { _count: true } },
        });
        return NextResponse.json({ categories });
      }

      if (categoryCode && serieNumber) {
        const category = await db.category.findUnique({
          where: { code: categoryCode },
          include: {
            series: {
              where: { number: parseInt(serieNumber) },
              _includeQuestions: true,
            },
          },
        });
        return NextResponse.json({ category });
      }

      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    } catch (error) {
      console.error('Error fetching import status:', error);
      return NextResponse.json({ categories: [] });
    }
  } catch (error) {
    console.error('Error fetching import status:', error);
    return NextResponse.json({ categories: [] });
  }
}

function getCategoryName(code: string): string {
  const names: Record<string, string> = {
    A: 'Moto', B: 'Voiture', C: 'Camion', D: 'Bus', E: 'Remorque',
  };
  return names[code] || code;
}

function getCategoryNameAr(code: string): string {
  const names: Record<string, string> = {
    A: 'دراجة نارية', B: 'سيارة', C: 'شاحنة', D: 'حافلة', E: 'مقطورة',
  };
  return names[code] || code;
}
