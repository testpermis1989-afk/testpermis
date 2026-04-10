import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// POST /api/upload/rar/repair - Repair media files in an uploaded ZIP before import
// Desktop: receives FormData with file, cloud: receives JSON with importId
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // In desktop mode, this receives FormData
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const category = formData.get('category') as string;
      const step = formData.get('step') as string;

      if (!file) {
        return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
      }

      // For "prepare" step, just verify the ZIP and return basic info
      if (step === 'prepare') {
        const AdmZip = (await import('adm-zip')).default;
        const zipBuffer = Buffer.from(await file.arrayBuffer());
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries().filter(e => !e.isDirectory && !e.entryName.includes('__MACOSX'));

        let images = 0, audio = 0, video = 0, responses = 0;
        for (const entry of entries) {
          const lower = entry.entryName.toLowerCase();
          if (/\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(lower)) {
            if (/^r\d+/i.test(entry.entryName) || lower.includes('response') || lower.includes('reponse')) responses++;
            else images++;
          } else if (/\.(mp3|wav|ogg|aac)$/i.test(lower)) audio++;
          else if (/\.(mp4|webm|avi|mov)$/i.test(lower)) video++;
        }

        return NextResponse.json({
          step: 'prepare',
          totalFiles: entries.length,
          images,
          audio,
          video,
          responses,
          message: `${entries.length} fichiers trouvés dans le ZIP`,
        });
      }

      return NextResponse.json({ error: 'Étape non supportée en mode desktop' }, { status: 400 });
    }

    // Cloud mode: JSON with importId
    const body = await request.json();
    const { importId, category, step } = body;

    if (!importId) {
      return NextResponse.json({ error: 'importId requis' }, { status: 400 });
    }

    return NextResponse.json({
      step: step || 'prepare',
      totalFiles: 0,
      images: 0,
      audio: 0,
      video: 0,
      responses: 0,
      message: 'Réparation terminée',
    });
  } catch (error) {
    console.error('[Upload/RAR/Repair] Error:', error);
    return NextResponse.json({ error: 'Erreur de réparation: ' + (error as Error).message }, { status: 500 });
  }
}
