import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

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

    // Also add the TXT file if exists
    const txtFiles = (await readdir(uploadDir)).filter(f => f.endsWith('.txt'));
    for (const txt of txtFiles) {
      try {
        zip.addLocalFile(path.join(uploadDir, txt));
        totalFiles++;
      } catch {}
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
