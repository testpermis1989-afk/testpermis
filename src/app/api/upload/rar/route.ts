import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import AdmZip from 'adm-zip';
import { db } from '@/lib/db';
import { uploadFile, getPublicUrl } from '@/lib/supabase';
import { saveUploadJob, getUploadBuffer, deleteUploadJob } from '@/lib/upload-store';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

// POST /api/upload/rar - Upload, verify, compress and import ZIP file
// Supports 3 modes:
//   1. multipart/form-data + verifyOnly=true → Verify only, save to temp storage, return importId
//   2. multipart/form-data (no verifyOnly) → Direct upload + import in one request
//   3. JSON { importId, category, serie } → Load from temp storage and import
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Mode 3: JSON with importId (import from temp storage)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { importId, category: categoryCode, serie: serieNumber } = body;

      if (!importId || !categoryCode || !serieNumber) {
        return NextResponse.json({ error: 'Champs manquants (importId, category, serie)' }, { status: 400 });
      }

      // Load ZIP buffer from Supabase temp storage
      const zipBuffer = await getUploadBuffer(importId);
      if (!zipBuffer) {
        return NextResponse.json({ error: 'Fichier expiré, veuillez ré-uploader' }, { status: 400 });
      }

      // Also check for compressed version
      let compressedBuffer = await getUploadBuffer(importId + '_compressed');
      const bufferToUse = compressedBuffer || zipBuffer;

      // Extract and import
      const result = await extractAndImport(bufferToUse, categoryCode, parseInt(serieNumber));

      // Cleanup temp storage
      try { await deleteUploadJob(importId); } catch {}
      try { await deleteUploadJob(importId + '_compressed'); } catch {}

      return NextResponse.json({ success: true, ...result });
    }

    // Mode 1 & 2: multipart/form-data
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Utilisez FormData ou JSON pour uploader' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const categoryCode = formData.get('category') as string;
    const serieNumber = formData.get('serie') as string;
    const verifyOnly = formData.get('verifyOnly') === 'true';

    if (!file || !categoryCode || !serieNumber) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.zip')) {
      return NextResponse.json({ error: 'Seuls les fichiers ZIP sont acceptés' }, { status: 400 });
    }

    // Read ZIP into buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify ZIP
    let verification;
    try {
      verification = verifyZipBuffer(buffer);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Erreur lors de la vérification du fichier ZIP',
        details: (error as Error).message,
        verification: {
          isValid: false, errors: ['Fichier ZIP invalide ou corrompu'], warnings: [],
          txtFile: { found: false, questions: 0 },
          images: { count: 0, files: [], missing: [], corrupted: [] },
          audio: { count: 0, files: [], missing: [], corrupted: [] },
          video: { count: 0, files: [], corrupted: [] },
          responses: { count: 0, files: [], missing: [], corrupted: [] },
          questionsDetails: []
        }
      }, { status: 400 });
    }

    // Mode 1: Verify only → save to temp storage, return importId
    if (verifyOnly) {
      // Generate unique import ID
      const importId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      try {
        // Save ZIP buffer + metadata to Supabase temp storage
        await saveUploadJob(importId, buffer, {
          categoryCode,
          serieNumber,
          fileName: file.name,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          verified: verification.isValid,
          createdAt: Date.now(),
        });
      } catch (saveError) {
        console.error('Failed to save to temp storage:', saveError);
        // If temp storage fails but verification passed, still return results
        // The user can use direct upload as fallback
        return NextResponse.json({
          success: true,
          mode: 'verification',
          fileName: file.name,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          verification,
          importId: null,
          tempStorageError: true,
        });
      }

      return NextResponse.json({
        success: true,
        mode: 'verification',
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        verification,
        importId,
      });
    }

    // Mode 2: Direct import (everything in one request!)
    if (!verification.isValid) {
      return NextResponse.json({ success: false, error: 'La vérification a échoué', verification }, { status: 400 });
    }

    const result = await extractAndImport(buffer, categoryCode, parseInt(serieNumber));
    return NextResponse.json({
      success: true,
      verification,
      ...result
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + (error as Error).message }, { status: 500 });
  }
}

// Extract ZIP buffer and import to Supabase Storage + database
async function extractAndImport(zipBuffer: Buffer, categoryCode: string, serieNumber: number) {
  const storagePrefix = `series/${categoryCode}/${serieNumber}`;
  const extractedFiles = { images: 0, audio: 0, video: 0, responses: 0, txtFile: false as string | false };
  let questionsImported = 0;

  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // Auto-detect parent folder
    const topLevelDirs = new Set<string>();
    for (const entry of entries) {
      const parts = entry.entryName.split('/').filter(Boolean);
      if (parts.length >= 2) topLevelDirs.add(parts[0].toLowerCase());
    }
    let stripParent = '';
    if (topLevelDirs.size === 1) stripParent = [...topLevelDirs][0] + '/';

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let entryNameFull = entry.entryName;
      let entryName = entryNameFull.toLowerCase();
      if (stripParent && entryName.startsWith(stripParent)) {
        entryNameFull = entryNameFull.substring(stripParent.length);
        entryName = entryNameFull.toLowerCase();
      }
      const baseNameOriginal = path.basename(entryNameFull);

      // TXT file
      if (entryName.endsWith('.txt') && (
        entryName.includes('reponse') || entryName.includes('response') ||
        entryName.includes('answer') || entryName.includes('question') ||
        entryName === 'data.txt' || entryName.match(/^[^\/]+\.txt$/) ||
        entryName.endsWith('/reponses.txt') || entryName.endsWith('/responses.txt') ||
        entryName.endsWith('/answers.txt') || entryName.endsWith('/data.txt') ||
        baseNameOriginal.toLowerCase().startsWith('repons') ||
        baseNameOriginal.toLowerCase().startsWith('answer') ||
        baseNameOriginal.toLowerCase() === 'data.txt'
      )) {
        const txtData = entry.getData();
        extractedFiles.txtFile = txtData.toString('utf-8');
        continue;
      }

      let fileData: Buffer;
      try {
        fileData = entry.getData();
      } catch {
        continue;
      }

      if (isQuestionImage(entryName, entryNameFull)) {
        const storagePath = `${storagePrefix}/images/${baseNameOriginal}`;
        const ext = path.extname(baseNameOriginal).toLowerCase();
        const mime = MIME_TYPES[ext] || 'image/png';
        try {
          await uploadFile(storagePath, fileData, mime);
          extractedFiles.images++;
        } catch (err) {
          console.error(`Failed to upload image ${baseNameOriginal}:`, err);
        }
        continue;
      }

      if (isResponseImage(entryName, entryNameFull)) {
        const storagePath = `${storagePrefix}/responses/${baseNameOriginal}`;
        const ext = path.extname(baseNameOriginal).toLowerCase();
        const mime = MIME_TYPES[ext] || 'image/png';
        try {
          await uploadFile(storagePath, fileData, mime);
          extractedFiles.responses++;
        } catch (err) {
          console.error(`Failed to upload response image ${baseNameOriginal}:`, err);
        }
        continue;
      }

      if (isAudioFile(entryName, entryNameFull)) {
        const storagePath = `${storagePrefix}/audio/${baseNameOriginal}`;
        try {
          await uploadFile(storagePath, fileData, 'audio/mpeg');
          extractedFiles.audio++;
        } catch (err) {
          console.error(`Failed to upload audio ${baseNameOriginal}:`, err);
        }
        continue;
      }

      if (isVideoFile(entryName, entryNameFull)) {
        const storagePath = `${storagePrefix}/video/${baseNameOriginal}`;
        try {
          await uploadFile(storagePath, fileData, 'video/mp4');
          extractedFiles.video++;
        } catch (err) {
          console.error(`Failed to upload video ${baseNameOriginal}:`, err);
        }
        continue;
      }
    }

    // Process TXT and create DB entries
    if (extractedFiles.txtFile && typeof extractedFiles.txtFile === 'string') {
      questionsImported = await processTxtContent(extractedFiles.txtFile, categoryCode, serieNumber, storagePrefix);
    }
  } catch (error) {
    console.error('Extraction error:', error);
    throw error;
  }

  return {
    message: 'Fichier traité avec succès!',
    extracted: {
      images: extractedFiles.images,
      audio: extractedFiles.audio,
      video: extractedFiles.video,
      responses: extractedFiles.responses,
      txtProcessed: extractedFiles.txtFile !== false,
    },
    questionsImported,
  };
}

// Process TXT content and create questions in database
async function processTxtContent(txtContent: string, categoryCode: string, serieNumber: number, storagePrefix: string): Promise<number> {
  const lines = txtContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  let category = await db.category.findUnique({ where: { code: categoryCode } });
  if (!category) {
    category = await db.category.create({ data: { code: categoryCode, name: getCategoryName(categoryCode), nameAr: getCategoryNameAr(categoryCode) } });
  }

  let serie = await db.serie.findFirst({ where: { categoryId: category.id, number: serieNumber } });
  if (!serie) {
    serie = await db.serie.create({ data: { categoryId: category.id, number: serieNumber } });
  }

  await db.response.deleteMany({ where: { question: { serieId: serie.id } } });
  await db.question.deleteMany({ where: { serieId: serie.id } });

  let imported = 0;
  for (const line of lines) {
    const parts = line.split(/[\t\s,;]+/).filter(p => p);
    if (parts.length < 2) continue;
    const questionNumber = parseInt(parts[0]);
    const correctAnswers = parts[1];
    if (isNaN(questionNumber)) continue;

    const imageStoragePath = `${storagePrefix}/images`;
    const audioStoragePath = `${storagePrefix}/audio`;
    const videoStoragePath = `${storagePrefix}/video`;

    const imageFile = await findFileInStorage(imageStoragePath, questionNumber, ['q', '']);
    const audioFile = await findFileInStorage(audioStoragePath, questionNumber, ['q', ''], ['mp3']);
    const videoFile = await findFileInStorage(videoStoragePath, questionNumber, ['q', ''], ['mp4']);

    const question = await db.question.create({
      data: {
        serieId: serie.id,
        order: questionNumber,
        image: imageFile ? getPublicUrl(imageFile) : '',
        audio: audioFile ? getPublicUrl(audioFile) : '',
        video: videoFile ? getPublicUrl(videoFile) : null,
        text: '',
      },
    });

    for (let j = 1; j <= 4; j++) {
      await db.response.create({
        data: { questionId: question.id, order: j, text: `Réponse ${j}`, isCorrect: correctAnswers.includes(String(j)) },
      });
    }
    imported++;
  }

  await db.serie.update({ where: { id: serie.id }, data: { questionsCount: imported } });
  return imported;
}

// Find a file in Supabase Storage folder
async function findFileInStorage(folder: string, num: number, prefixes: string[], exts?: string[]): Promise<string | null> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.storage.from('uploads').list(folder);
    if (error || !data || data.length === 0) return null;

    const defaultExts = exts || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
    const numStr = String(num);

    for (const prefix of prefixes) {
      const baseName = prefix ? `${prefix}${numStr}` : numStr;
      for (const ext of defaultExts) {
        const target = `${baseName}.${ext}`;
        const match = data.find(f => f.name.toLowerCase() === target.toLowerCase());
        if (match) {
          return `${folder}/${match.name}`;
        }
      }
    }
  } catch (err) {
    console.error('Error listing storage files:', err);
  }
  return null;
}

// Verify ZIP buffer (no filesystem needed)
function verifyZipBuffer(zipBuffer: Buffer) {
  const result = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[],
    txtFile: { found: false, questions: 0 },
    images: { count: 0, files: [] as string[], missing: [] as number[], corrupted: [] as string[] },
    audio: { count: 0, files: [] as string[], missing: [] as number[], corrupted: [] as string[] },
    video: { count: 0, files: [] as string[], corrupted: [] as string[] },
    responses: { count: 0, files: [] as string[], missing: [] as number[], corrupted: [] as string[] },
    questionsDetails: [] as { num: number; hasImage: boolean; hasAudio: boolean; hasVideo: boolean; hasResponse: boolean; answers: string; imageValid: boolean; audioValid: boolean; videoValid: boolean; responseValid: boolean }[]
  };

  let zip: AdmZip;
  let entries: AdmZip.IZipEntry[];

  try {
    zip = new AdmZip(zipBuffer);
    entries = zip.getEntries();
  } catch (zipError) {
    result.isValid = false;
    result.errors.push(`Impossible d'ouvrir le fichier ZIP: ${(zipError as Error).message}`);
    return result;
  }

  if (!entries || entries.length === 0) {
    result.errors.push('Le fichier ZIP est vide');
    result.isValid = false;
    return result;
  }

  const topLevelDirs = new Set<string>();
  for (const entry of entries) {
    const parts = entry.entryName.split('/').filter(Boolean);
    if (parts.length >= 2) topLevelDirs.add(parts[0].toLowerCase());
  }
  let stripParent = '';
  if (topLevelDirs.size === 1) stripParent = [...topLevelDirs][0] + '/';

  const questionImages = new Map<number, { name: string; valid: boolean }>();
  const questionAudio = new Map<number, { name: string; valid: boolean }>();
  const questionVideo = new Map<number, { name: string; valid: boolean }>();
  const responseImages = new Map<number, { name: string; valid: boolean }>();
  let txtContent = '';
  let txtFound = false;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let entryNameFull = entry.entryName;
    let entryName = entryNameFull.toLowerCase();
    if (stripParent && entryName.startsWith(stripParent)) {
      entryNameFull = entryNameFull.substring(stripParent.length);
      entryName = entryNameFull.toLowerCase();
    }
    const baseNameOriginal = path.basename(entryNameFull);

    let fileData: Buffer;
    try {
      fileData = entry.getData();
    } catch {
      continue;
    }

    if (entryName.endsWith('.txt') && !txtFound) {
      try {
        txtContent = fileData.toString('utf-8');
        txtFound = true;
        result.txtFile.found = true;
      } catch {
        result.errors.push(`Erreur de lecture TXT (${baseNameOriginal})`);
      }
      continue;
    }

    if (isQuestionImage(entryName, entryNameFull)) {
      const num = extractQuestionNumber(baseNameOriginal);
      if (num) {
        const isValid = validateImageFile(fileData, baseNameOriginal);
        questionImages.set(num, { name: baseNameOriginal, valid: isValid });
        result.images.files.push(baseNameOriginal);
        if (!isValid) result.images.corrupted.push(baseNameOriginal);
      }
      continue;
    }

    if (isResponseImage(entryName, entryNameFull)) {
      const num = extractResponseNumber(baseNameOriginal);
      if (num) {
        const isValid = validateImageFile(fileData, baseNameOriginal);
        responseImages.set(num, { name: baseNameOriginal, valid: isValid });
        result.responses.files.push(baseNameOriginal);
        if (!isValid) result.responses.corrupted.push(baseNameOriginal);
      }
      continue;
    }

    if (isAudioFile(entryName, entryNameFull)) {
      const num = extractQuestionNumber(baseNameOriginal);
      if (num) {
        const isValid = validateMp3File(fileData, baseNameOriginal);
        questionAudio.set(num, { name: baseNameOriginal, valid: isValid });
        result.audio.files.push(baseNameOriginal);
        if (!isValid) result.audio.corrupted.push(baseNameOriginal);
      }
      continue;
    }

    if (isVideoFile(entryName, entryNameFull)) {
      const num = extractQuestionNumber(baseNameOriginal);
      if (num) {
        const isValid = validateMp4File(fileData, baseNameOriginal);
        questionVideo.set(num, { name: baseNameOriginal, valid: isValid });
        result.video.files.push(baseNameOriginal);
        if (!isValid) result.video.corrupted.push(baseNameOriginal);
      }
      continue;
    }
  }

  if (!txtFound) {
    result.errors.push('Aucun fichier TXT trouvé (reponses.txt)');
    result.isValid = false;
    return result;
  }

  const lines = txtContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const questionNumbers: number[] = [];
  const questionAnswers = new Map<number, string>();

  for (const line of lines) {
    const parts = line.split(/[\t\s,;]+/).filter(p => p);
    if (parts.length >= 2) {
      const qNum = parseInt(parts[0]);
      if (!isNaN(qNum)) {
        questionNumbers.push(qNum);
        questionAnswers.set(qNum, parts[1]);
      }
    }
  }

  result.txtFile.questions = questionNumbers.length;
  if (questionNumbers.length === 0) {
    result.errors.push('Aucune question trouvée dans le TXT');
    result.isValid = false;
    return result;
  }

  for (const qNum of questionNumbers.sort((a, b) => a - b)) {
    result.questionsDetails.push({
      num: qNum,
      hasImage: !!questionImages.get(qNum),
      hasAudio: !!questionAudio.get(qNum),
      hasVideo: !!questionVideo.get(qNum),
      hasResponse: !!responseImages.get(qNum),
      answers: questionAnswers.get(qNum) || '',
      imageValid: questionImages.get(qNum)?.valid ?? false,
      audioValid: questionAudio.get(qNum)?.valid ?? false,
      videoValid: questionVideo.get(qNum)?.valid ?? false,
      responseValid: responseImages.get(qNum)?.valid ?? false,
    });

    if (!questionImages.get(qNum) && !questionVideo.get(qNum)) result.images.missing.push(qNum);
    if (!questionAudio.get(qNum)) result.audio.missing.push(qNum);
    if (!responseImages.get(qNum)) result.responses.missing.push(qNum);
  }

  result.images.count = questionImages.size;
  result.audio.count = questionAudio.size;
  result.video.count = questionVideo.size;
  result.responses.count = responseImages.size;

  if (result.images.corrupted.length > 0) result.errors.push(`Images corrompues: ${result.images.corrupted.join(', ')}`);
  if (result.audio.corrupted.length > 0) result.errors.push(`Audio corrompus: ${result.audio.corrupted.join(', ')}`);
  result.isValid = result.errors.length === 0;

  return result;
}

function validateImageFile(data: Buffer, filename: string): boolean {
  if (data.length < 8) return false;
  const h = data.slice(0, 16);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return true;
  if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return true;
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38) return true;
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return true;
  if (h[0] === 0x42 && h[1] === 0x4D) return true;
  return false;
}

function validateMp3File(data: Buffer, filename: string): boolean {
  if (data.length < 10) return false;
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true;
  if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true;
  return false;
}

function validateMp4File(data: Buffer, filename: string): boolean {
  if (data.length < 12) return false;
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true;
  if (data[4] === 0x6D && data[5] === 0x6F && data[6] === 0x6F && data[7] === 0x76) return true;
  if (data[4] === 0x6D && data[5] === 0x64 && data[6] === 0x61 && data[7] === 0x74) return true;
  return false;
}

function extractQuestionNumber(filename: string): number | null {
  const match = filename.match(/(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function extractResponseNumber(filename: string): number | null {
  const match = filename.match(/r(\d+)/i);
  return match ? parseInt(match[1]) : extractQuestionNumber(filename);
}

function isQuestionImage(entryName: string, entryNameOriginal: string): boolean {
  const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
  if (!exts.some(ext => entryName.endsWith(ext))) return false;
  if (entryName.includes('images/') || entryName.includes('image/') || entryName.includes('questions/') || entryName.includes('question/')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  if (/^q\d+/i.test(base) || /^\d+\./.test(base)) return true;
  return false;
}

function isResponseImage(entryName: string, entryNameOriginal: string): boolean {
  const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
  if (!exts.some(ext => entryName.endsWith(ext))) return false;
  if (entryName.includes('responses/') || entryName.includes('response/') || entryName.includes('reponses/') || entryName.includes('reponse/') || entryName.includes('r/') || entryName.includes('answers/')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  if (/^r\d+/i.test(base)) return true;
  return false;
}

function isAudioFile(entryName: string, entryNameOriginal: string): boolean {
  if (!entryName.endsWith('.mp3')) return false;
  if (entryName.includes('audio/') || entryName.includes('son/') || entryName.includes('sound/')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  if (/^q\d+/i.test(base) || /^\d+\.mp3$/i.test(base)) return true;
  return false;
}

function isVideoFile(entryName: string, entryNameOriginal: string): boolean {
  if (!entryName.endsWith('.mp4')) return false;
  if (entryName.includes('video/') || entryName.includes('videos/')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  if (/^q\d+/i.test(base) || /^\d+\.mp4$/i.test(base)) return true;
  return false;
}

function getCategoryName(code: string): string {
  return { A: 'Moto', B: 'Voiture', C: 'Camion', D: 'Bus', E: 'Remorque' }[code] || code;
}

function getCategoryNameAr(code: string): string {
  return { A: 'دراجة نارية', B: 'سيارة', C: 'شاحنة', D: 'حافلة', E: 'مقطورة' }[code] || code;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  const storagePrefix = `series/${categoryCode}/${serieNumber}`;
  const result = { path: storagePrefix, images: [] as string[], audio: [] as string[], video: [] as string[], responses: [] as string[], exists: false };

  const { listFiles } = await import('@/lib/supabase');

  const subDirs = [
    { key: 'images' as const, folder: `${storagePrefix}/images`, exts: /\.(png|jpg|jpeg|gif|webp|bmp)$/i },
    { key: 'audio' as const, folder: `${storagePrefix}/audio`, exts: /\.mp3$/i },
    { key: 'video' as const, folder: `${storagePrefix}/video`, exts: /\.mp4$/i },
    { key: 'responses' as const, folder: `${storagePrefix}/responses`, exts: /\.(png|jpg|jpeg|gif|webp|bmp)$/i },
  ];

  for (const sub of subDirs) {
    try {
      const files = await listFiles(sub.folder);
      if (files.length > 0) result.exists = true;
      (result as Record<string, string[]>)[sub.key] = files.filter(f => sub.exts.test(f));
    } catch {}
  }

  return NextResponse.json(result);
}
