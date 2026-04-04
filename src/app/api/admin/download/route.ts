import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { db } from '@/lib/db';
import { supabase, downloadFile, listFiles, toStoragePath } from '@/lib/supabase';

// POST /api/admin/download - Download a series as ZIP (from Supabase Storage)
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  const storagePrefix = `series/${categoryCode}/${serieNumber}`;

  try {
    const zip = new AdmZip();
    const subDirs = ['images', 'audio', 'video', 'responses'];
    let totalFiles = 0;

    // Download files from Supabase Storage and add to ZIP
    for (const subDir of subDirs) {
      const folder = `${storagePrefix}/${subDir}`;
      try {
        const files = await listFiles(folder);
        for (const file of files) {
          try {
            const filePath = `${folder}/${file}`;
            const fileBuffer = await downloadFile(filePath);
            zip.addFile(`${subDir}/${file}`, fileBuffer);
            totalFiles++;
          } catch (err) {
            console.error(`Failed to download ${folder}/${file}:`, err);
          }
        }
      } catch (err) {
        // Folder doesn't exist - skip
      }
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
        const lines: string[] = [];

        for (const q of serie.questions) {
          const correctResponses = q.responses
            .filter(r => r.isCorrect)
            .map(r => r.order)
            .sort();
          const answerStr = correctResponses.join('');
          lines.push(`${q.order} ${answerStr}`);
        }

        const reponsesContent = lines.join('\n') + '\n';
        zip.addFile('reponses.txt', Buffer.from(reponsesContent, 'utf-8'));
        totalFiles++;
      }
    } catch (dbError) {
      console.error('Error generating reponses.txt from DB:', dbError);
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
