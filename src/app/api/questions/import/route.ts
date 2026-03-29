import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as xlsx from 'xlsx';

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
    await db.response.deleteMany({ where: { question: { serieId: serie.id } } });
    await db.question.deleteMany({ where: { serieId: serie.id } });

    // Import questions
    let imported = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const questionNumber = parseInt(String(row[0]));
      const correctAnswers = String(row[1]);

      if (isNaN(questionNumber)) continue;

      // Create question with image, audio, and response image
      const question = await db.question.create({
        data: {
          serieId: serie.id,
          order: questionNumber,
          image: `/uploads/${categoryCode}/${serieNumber}/images/q${questionNumber}.png`,
          audio: `/uploads/${categoryCode}/${serieNumber}/audio/q${questionNumber}.mp3`,
          text: `/uploads/${categoryCode}/${serieNumber}/responses/r${questionNumber}.png`, // Response image
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
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

// GET /api/questions/import - Get import status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode) {
    // Get all categories with their series
    const categories = await db.category.findMany({
      include: {
        series: {
          include: {
            _count: { select: { questions: true } },
          },
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
          include: {
            questions: {
              include: { responses: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });
    return NextResponse.json({ category });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
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
