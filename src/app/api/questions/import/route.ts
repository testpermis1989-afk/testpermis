import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

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

    const db = await getDb();

    // Read Excel file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];

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
        data: {
          categoryId: category.id,
          number: serieNumber,
        },
      });
    }

    // Clear existing questions in this serie
    // First get all question IDs in this serie, then delete their responses, then delete questions
    // (compatible with both Prisma and sql.js local-db)
    const existingQuestions = await db.question.findMany({ where: { serieId: serie.id } });
    if (existingQuestions.length > 0) {
      const qIds = existingQuestions.map((q: any) => q.id);
      for (const qId of qIds) {
        try {
          await db.response.deleteMany({ where: { questionId: qId } });
        } catch { /* ignore */ }
      }
      await db.question.deleteMany({ where: { serieId: serie.id } });
    }

    // Import questions
    let imported = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const questionNumber = parseInt(String(row[0]));
      const correctAnswers = String(row[1]);

      if (isNaN(questionNumber)) continue;

      // Create question with local file URLs
      const imageStoragePath = `series/${categoryCode}/${serieNumber}/images/q${questionNumber}.png`;
      const audioStoragePath = `series/${categoryCode}/${serieNumber}/audio/q${questionNumber}.mp3`;
      const responseStoragePath = `series/${categoryCode}/${serieNumber}/responses/r${questionNumber}.png`;

      const question = await db.question.create({
        data: {
          serieId: serie.id,
          order: questionNumber,
          image: getFileUrl(imageStoragePath),
          audio: getFileUrl(audioStoragePath),
          text: getFileUrl(responseStoragePath),
        },
      });

      // Create 4 responses (default)
      for (let j = 1; j <= 4; j++) {
        const isCorrect = correctAnswers.includes(String(j));
        await db.response.create({
          data: {
            questionId: question.id,
            order: j,
            text: `Réponse ${j}`,
            isCorrect,
          },
        });
      }

      imported++;
    }

    // Update serie questions count
    await db.serie.update({
      where: { id: serie.id },
      data: { questionsCount: imported },
    });

    return NextResponse.json({
      success: true,
      imported,
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

    const db = await getDb();

    if (!categoryCode) {
      // Get all categories with their series
      const categories = await db.category.findMany({
        include: {
          series: {
            _count: true,
          },
        },
      });
      return NextResponse.json({ categories });
    }

    if (categoryCode && serieNumber) {
      // Get specific serie with questions
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
    return NextResponse.json(
      { error: 'Failed to fetch: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

function getCategoryName(code: string): string {
  const names: Record<string, string> = {
    A: 'Moto',
    B: 'Voiture',
    C: 'Camion',
    D: 'Bus',
    E: 'Remorque',
  };
  return names[code] || code;
}

function getCategoryNameAr(code: string): string {
  const names: Record<string, string> = {
    A: 'دراجة نارية',
    B: 'سيارة',
    C: 'شاحنة',
    D: 'حافلة',
    E: 'مقطورة',
  };
  return names[code] || code;
}
