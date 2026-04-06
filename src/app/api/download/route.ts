import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const zipPath = path.join(process.cwd(), 'public', 'TestPermis_Desktop.zip');
    
    if (!fs.existsSync(zipPath)) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(zipPath);
    const stat = fs.statSync(zipPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="TestPermis_Desktop.zip"',
        'Content-Length': String(stat.size),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Erreur de téléchargement' }, { status: 500 });
  }
}
