import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';

// POST /api/upload/rar/verify - Verify ZIP structure without importing (cloud mode)
export async function POST(request: NextRequest) {
  try {
    const { importId } = await request.json();
    if (!importId) {
      return NextResponse.json({ error: 'importId requis' }, { status: 400 });
    }

    const { getUploadBuffer } = await import('@/lib/upload-store');
    const zipBuffer = await getUploadBuffer(importId);
    if (!zipBuffer) {
      return NextResponse.json({ error: 'Fichier expiré. Veuillez ré-uploader.' }, { status: 400 });
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      return NextResponse.json({
        verification: { isValid: false, errors: ['ZIP corrompu'], warnings: [], extracted: { images: 0, audio: 0, video: 0, responses: 0 } },
      });
    }

    const entries = zip.getEntries().filter(e => !e.isDirectory && !e.entryName.includes('__MACOSX'));
    const errors: string[] = [];
    const warnings: string[] = [];
    let hasAnswerFile = false;
    let imageCount = 0, audioCount = 0, videoCount = 0, responseCount = 0;

    for (const entry of entries) {
      const lowerName = entry.entryName.toLowerCase();
      if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(lowerName)) {
        if (/^r\d+/i.test(entry.entryName) || lowerName.includes('response') || lowerName.includes('reponse')) {
          responseCount++;
        } else {
          imageCount++;
        }
      } else if (/\.(mp3|wav|ogg|aac)$/i.test(lowerName)) audioCount++;
      else if (/\.(mp4|webm|avi|mov)$/i.test(lowerName)) videoCount++;
      else if (/^(reponses?|answers?|corrige)\.(txt|csv)$/i.test(entry.entryName)) hasAnswerFile = true;
    }

    if (imageCount === 0 && audioCount === 0) errors.push('Aucun fichier média trouvé');
    if (!hasAnswerFile) warnings.push('Fichier réponses manquant');

    return NextResponse.json({
      verification: {
        isValid: errors.length === 0,
        errors,
        warnings,
        extracted: { images: imageCount, audio: audioCount, video: videoCount, responses: responseCount },
        hasAnswerFile,
      },
    });
  } catch (error) {
    console.error('[Upload/RAR/Verify] Error:', error);
    return NextResponse.json({ error: 'Erreur de vérification: ' + (error as Error).message }, { status: 500 });
  }
}
