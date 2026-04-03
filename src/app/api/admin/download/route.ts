import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { db } from '@/lib/db';

// Mapping catégorie lettre → numéro (A→1, B→2, C→3, D→4, E→5)
const categoryToNumber: Record<string, string> = {
  A: '1',
  B: '2',
  C: '3',
  D: '4',
  E: '5',
};

// POST /api/admin/download - Download a series as ZIP
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber);
  if (!existsSync(uploadDir)) {
    return NextResponse.json({ error: 'Série non trouvée' }, { status: 404 });
  }

  try {
    const zip = new AdmZip();
    const subDirs = ['images', 'audio', 'video', 'responses'];
    let totalFiles = 0;

    for (const subDir of subDirs) {
      const dir = path.join(uploadDir, subDir);
      if (!existsSync(dir)) continue;
      const files = await readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          if ((await stat(filePath)).isFile()) {
            zip.addLocalFile(filePath, subDir);
            totalFiles++;
          }
        } catch {}
      }
    }

    // Also add existing TXT files (skip reponses.txt if already exists, we'll regenerate it)
    const txtFiles = (await readdir(uploadDir)).filter(f => f.endsWith('.txt') && f !== 'reponses.txt');
    for (const txt of txtFiles) {
      try {
        zip.addLocalFile(path.join(uploadDir, txt));
        totalFiles++;
      } catch {}
    }

    // Generate reponses.txt from database
    try {
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

      if (category && category.series.length > 0) {
        const serie = category.series[0];
        const catNum = categoryToNumber[categoryCode] || categoryCode;
        const lines: string[] = [];

        for (const q of serie.questions) {
          const correctResponses = q.responses
            .filter(r => r.isCorrect)
            .map(r => r.order)
            .sort();
          const answerStr = correctResponses.join('');
          lines.push(`${q.order}${answerStr}`);
        }

        const reponsesContent = lines.join('\n') + '\n';
        zip.addFile('reponses.txt', Buffer.from(reponsesContent, 'utf-8'));
        totalFiles++;
      }
    } catch (dbError) {
      console.error('Error generating reponses.txt from DB:', dbError);
      // Fallback: try to find existing reponses.txt in uploadDir
      const existingReponses = path.join(uploadDir, 'reponses.txt');
      if (existsSync(existingReponses)) {
        try {
          zip.addLocalFile(existingReponses);
          totalFiles++;
        } catch {}
      }
    }

    if (totalFiles === 0) {
      return NextResponse.json({ error: 'Aucun fichier trouvé' }, { status: 404 });
    }

    const zipBuffer = zip.toBuffer();
    const zipName = `${categoryCode}_Serie${serieNumber}.zip`;

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
