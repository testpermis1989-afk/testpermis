import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { db } from '@/lib/db';

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

// Check if we're in desktop/local mode
function isLocalMode(): boolean {
  return (process.env.STORAGE_MODE || '') === 'local' || !!(process.env.DATABASE_URL || '').includes('file:');
}

function getLocalDataDir(): string {
  return process.env.LOCAL_DATA_DIR || path.join(process.cwd(), 'data');
}

// POST /api/upload/rar - Upload, verify, compress and import ZIP file
// Desktop mode: multipart/form-data (direct upload + import)
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const localMode = isLocalMode();

    // In desktop mode: only accept multipart/form-data
    if (!contentType.includes('multipart/form-data')) {
      if (localMode) {
        return NextResponse.json({ error: 'Mode desktop: utilisez FormData pour uploader' }, { status: 400 });
      }
      // Cloud mode: JSON with importId
      const body = await request.json();
      const { importId, category: categoryCode, serie: serieNumber } = body;
      if (!importId || !categoryCode || !serieNumber) {
        return NextResponse.json({ error: 'Champs manquants (importId, category, serie)' }, { status: 400 });
      }
      // Cloud mode not available in desktop build
      return NextResponse.json({ error: 'Upload to cloud not available in desktop mode' }, { status: 400 });
    }

    // multipart/form-data mode
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
      }, { status: 400 });
    }

    // If verifyOnly, just return verification result
    if (verifyOnly) {
      return NextResponse.json({
        success: true,
        mode: 'verification',
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        verification,
        importId: null,
        tempStorageError: true, // indicate no temp storage available
      });
    }

    // Direct import
    if (!verification.isValid) {
      return NextResponse.json({ success: false, error: 'La vérification a échoué', verification }, { status: 400 });
    }

    const result = localMode
      ? await extractAndImportLocal(buffer, categoryCode, parseInt(serieNumber))
      : await extractAndImportCloud(buffer, categoryCode, parseInt(serieNumber));

    return NextResponse.json({
      success: true,
      verification,
      ...result,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + (error as Error).message }, { status: 500 });
  }
}

// =====================================================
// LOCAL MODE: Extract ZIP to local filesystem + save to DB
// Images are auto-compressed (WebP) during import
// =====================================================
async function extractAndImportLocal(zipBuffer: Buffer, categoryCode: string, serieNumber: number) {
  const dataDir = getLocalDataDir();
  const uploadsDir = path.join(dataDir, 'uploads');
  const seriesDir = path.join(uploadsDir, `series/${categoryCode}/${serieNumber}`);
  const extractedFiles = { images: 0, audio: 0, video: 0, responses: 0, txtFile: false as string | false, compressed: 0, savedBytes: 0 };
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

      let fileData: Buffer;
      try {
        fileData = entry.getData();
      } catch {
        continue;
      }

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
        extractedFiles.txtFile = fileData.toString('utf-8');
        continue;
      }

      if (isQuestionImage(entryName, entryNameFull)) {
        const dirPath = path.join(seriesDir, 'images');
        fs.mkdirSync(dirPath, { recursive: true });
        // Auto-compress images (keep same format)
        const ext = path.extname(baseNameOriginal).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff'].includes(ext)) {
          try {
            let compressedData: Buffer;
            if (ext === '.png') {
              compressedData = await sharp(fileData)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .png({ quality: 80, compressionLevel: 9 })
                .toBuffer();
            } else {
              compressedData = await sharp(fileData)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 75 })
                .toBuffer();
            }
            const savedName = baseNameOriginal.replace(/\.[^.]+$/, ext === '.jpeg' ? '.jpg' : ext);
            fs.writeFileSync(path.join(dirPath, savedName), compressedData);
            extractedFiles.savedBytes += Math.max(0, fileData.length - compressedData.length);
            extractedFiles.compressed++;
          } catch {
            // If compression fails, save original
            fs.writeFileSync(path.join(dirPath, baseNameOriginal), fileData);
          }
        } else {
          fs.writeFileSync(path.join(dirPath, baseNameOriginal), fileData);
        }
        extractedFiles.images++;
        continue;
      }

      if (isResponseImage(entryName, entryNameFull)) {
        const dirPath = path.join(seriesDir, 'responses');
        fs.mkdirSync(dirPath, { recursive: true });
        // Auto-compress response images (keep same format)
        const ext = path.extname(baseNameOriginal).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff'].includes(ext)) {
          try {
            let compressedData: Buffer;
            if (ext === '.png') {
              compressedData = await sharp(fileData)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .png({ quality: 80, compressionLevel: 9 })
                .toBuffer();
            } else {
              compressedData = await sharp(fileData)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 75 })
                .toBuffer();
            }
            const savedName = baseNameOriginal.replace(/\.[^.]+$/, ext === '.jpeg' ? '.jpg' : ext);
            fs.writeFileSync(path.join(dirPath, savedName), compressedData);
            extractedFiles.savedBytes += Math.max(0, fileData.length - compressedData.length);
            extractedFiles.compressed++;
          } catch {
            fs.writeFileSync(path.join(dirPath, baseNameOriginal), fileData);
          }
        } else {
          fs.writeFileSync(path.join(dirPath, baseNameOriginal), fileData);
        }
        extractedFiles.responses++;
        continue;
      }

      if (isAudioFile(entryName, entryNameFull)) {
        const dirPath = path.join(seriesDir, 'audio');
        fs.mkdirSync(dirPath, { recursive: true });
        fs.writeFileSync(path.join(dirPath, baseNameOriginal), fileData);
        extractedFiles.audio++;
        continue;
      }

      if (isVideoFile(entryName, entryNameFull)) {
        const dirPath = path.join(seriesDir, 'video');
        fs.mkdirSync(dirPath, { recursive: true });
        fs.writeFileSync(path.join(dirPath, baseNameOriginal), fileData);
        extractedFiles.video++;
        continue;
      }
    }

    // Process TXT and create DB entries
    if (extractedFiles.txtFile && typeof extractedFiles.txtFile === 'string') {
      questionsImported = await processTxtContentLocal(extractedFiles.txtFile, categoryCode, serieNumber);
    }
  } catch (error) {
    console.error('Extraction error:', error);
    throw error;
  }

  const formatSize = (b: number) => {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  };

  return {
    message: 'Fichier traité avec succès!',
    extracted: {
      images: extractedFiles.images,
      audio: extractedFiles.audio,
      video: extractedFiles.video,
      responses: extractedFiles.responses,
      txtProcessed: extractedFiles.txtFile !== false,
    },
    compression: {
      imagesCompressed: extractedFiles.compressed,
      savedBytes: extractedFiles.savedBytes,
      savedFormatted: formatSize(extractedFiles.savedBytes),
    },
    questionsImported,
  };
}

// Process TXT content and create questions (LOCAL mode - uses /api/serve/ URLs)
async function processTxtContentLocal(txtContent: string, categoryCode: string, serieNumber: number): Promise<number> {
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

    // Use local /api/serve/ URLs instead of Supabase URLs
    const imageUrl = `/api/serve/series/${categoryCode}/${serieNumber}/images/q${questionNumber}.png`;
    const audioUrl = `/api/serve/series/${categoryCode}/${serieNumber}/audio/q${questionNumber}.mp3`;

    const question = await db.question.create({
      data: {
        serieId: serie.id,
        order: questionNumber,
        image: imageUrl,
        audio: audioUrl,
        video: null,
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

// =====================================================
// CLOUD MODE: Extract ZIP to Supabase Storage + save to DB
// (kept for backward compatibility, but won't be used in desktop)
// =====================================================
async function extractAndImportCloud(zipBuffer: Buffer, categoryCode: string, serieNumber: number) {
  // Dynamic import for cloud-only modules
  const { uploadFile, getPublicUrl } = await import('@/lib/supabase');

  const storagePrefix = `series/${categoryCode}/${serieNumber}`;
  const extractedFiles = { images: 0, audio: 0, video: 0, responses: 0, txtFile: false as string | false };
  let questionsImported = 0;

  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

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

      if (entryName.endsWith('.txt') && (
        entryName.includes('reponse') || entryName.includes('response') ||
        entryName.includes('answer') || entryName.includes('question') ||
        entryName === 'data.txt' || entryName.match(/^[^\/]+\.txt$/) ||
        baseNameOriginal.toLowerCase().startsWith('repons') ||
        baseNameOriginal.toLowerCase().startsWith('answer') ||
        baseNameOriginal.toLowerCase() === 'data.txt'
      )) {
        extractedFiles.txtFile = entry.getData().toString('utf-8');
        continue;
      }

      let fileData: Buffer;
      try { fileData = entry.getData(); } catch { continue; }

      if (isQuestionImage(entryName, entryNameFull)) {
        const storagePath = `${storagePrefix}/images/${baseNameOriginal}`;
        const ext = path.extname(baseNameOriginal).toLowerCase();
        const mime = MIME_TYPES[ext] || 'image/png';
        try { await uploadFile(storagePath, fileData, mime); } catch (err) { console.error(`Failed to upload image ${baseNameOriginal}:`, err); }
        extractedFiles.images++;
        continue;
      }
      if (isResponseImage(entryName, entryNameFull)) {
        const storagePath = `${storagePrefix}/responses/${baseNameOriginal}`;
        const ext = path.extname(baseNameOriginal).toLowerCase();
        const mime = MIME_TYPES[ext] || 'image/png';
        try { await uploadFile(storagePath, fileData, mime); } catch (err) { console.error(`Failed to upload response ${baseNameOriginal}:`, err); }
        extractedFiles.responses++;
        continue;
      }
      if (isAudioFile(entryName, entryNameFull)) {
        const storagePath = `${storagePrefix}/audio/${baseNameOriginal}`;
        try { await uploadFile(storagePath, fileData, 'audio/mpeg'); } catch (err) { console.error(`Failed to upload audio ${baseNameOriginal}:`, err); }
        extractedFiles.audio++;
        continue;
      }
      if (isVideoFile(entryName, entryNameFull)) {
        const storagePath = `${storagePrefix}/video/${baseNameOriginal}`;
        try { await uploadFile(storagePath, fileData, 'video/mp4'); } catch (err) { console.error(`Failed to upload video ${baseNameOriginal}:`, err); }
        extractedFiles.video++;
        continue;
      }
    }

    if (extractedFiles.txtFile && typeof extractedFiles.txtFile === 'string') {
      questionsImported = await processTxtContentCloud(extractedFiles.txtFile, categoryCode, serieNumber, storagePrefix);
    }
  } catch (error) {
    console.error('Cloud extraction error:', error);
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

async function processTxtContentCloud(txtContent: string, categoryCode: string, serieNumber: number, storagePrefix: string): Promise<number> {
  const { getPublicUrl } = await import('@/lib/supabase');

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

    const question = await db.question.create({
      data: {
        serieId: serie.id,
        order: questionNumber,
        image: getPublicUrl(`${storagePrefix}/images`),
        audio: getPublicUrl(`${storagePrefix}/audio`),
        video: null,
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

// =====================================================
// ZIP VERIFICATION (shared between modes)
// =====================================================
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
    try { fileData = entry.getData(); } catch { continue; }

    if (entryName.endsWith('.txt') && !txtFound) {
      try { txtContent = fileData.toString('utf-8'); txtFound = true; result.txtFile.found = true; } catch { result.errors.push(`Erreur de lecture TXT (${baseNameOriginal})`); }
      continue;
    }

    if (isQuestionImage(entryName, entryNameFull)) {
      const num = extractQuestionNumber(baseNameOriginal);
      if (num) { const isValid = validateImageFile(fileData, baseNameOriginal); questionImages.set(num, { name: baseNameOriginal, valid: isValid }); result.images.files.push(baseNameOriginal); if (!isValid) result.images.corrupted.push(baseNameOriginal); }
      continue;
    }
    if (isResponseImage(entryName, entryNameFull)) {
      const num = extractResponseNumber(baseNameOriginal);
      if (num) { const isValid = validateImageFile(fileData, baseNameOriginal); responseImages.set(num, { name: baseNameOriginal, valid: isValid }); result.responses.files.push(baseNameOriginal); if (!isValid) result.responses.corrupted.push(baseNameOriginal); }
      continue;
    }
    if (isAudioFile(entryName, entryNameFull)) {
      const num = extractQuestionNumber(baseNameOriginal);
      if (num) { const isValid = validateMp3File(fileData, baseNameOriginal); questionAudio.set(num, { name: baseNameOriginal, valid: isValid }); result.audio.files.push(baseNameOriginal); if (!isValid) result.audio.corrupted.push(baseNameOriginal); }
      continue;
    }
    if (isVideoFile(entryName, entryNameFull)) {
      const num = extractQuestionNumber(baseNameOriginal);
      if (num) { const isValid = validateMp4File(fileData, baseNameOriginal); questionVideo.set(num, { name: baseNameOriginal, valid: isValid }); result.video.files.push(baseNameOriginal); if (!isValid) result.video.corrupted.push(baseNameOriginal); }
      continue;
    }
  }

  if (!txtFound) { result.errors.push('Aucun fichier TXT trouvé (reponses.txt)'); result.isValid = false; return result; }

  const lines = txtContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const questionNumbers: number[] = [];
  const questionAnswers = new Map<number, string>();

  for (const line of lines) {
    const parts = line.split(/[\t\s,;]+/).filter(p => p);
    if (parts.length >= 2) {
      const qNum = parseInt(parts[0]);
      if (!isNaN(qNum)) { questionNumbers.push(qNum); questionAnswers.set(qNum, parts[1]); }
    }
  }

  result.txtFile.questions = questionNumbers.length;
  if (questionNumbers.length === 0) { result.errors.push('Aucune question trouvée dans le TXT'); result.isValid = false; return result; }

  for (const qNum of questionNumbers.sort((a, b) => a - b)) {
    result.questionsDetails.push({
      num: qNum, hasImage: !!questionImages.get(qNum), hasAudio: !!questionAudio.get(qNum),
      hasVideo: !!questionVideo.get(qNum), hasResponse: !!responseImages.get(qNum),
      answers: questionAnswers.get(qNum) || '',
      imageValid: questionImages.get(qNum)?.valid ?? false, audioValid: questionAudio.get(qNum)?.valid ?? false,
      videoValid: questionVideo.get(qNum)?.valid ?? false, responseValid: responseImages.get(qNum)?.valid ?? false,
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

// =====================================================
// FILE HELPERS
// =====================================================
function validateImageFile(data: Buffer, _filename: string): boolean {
  if (data.length < 8) return false;
  const h = data.slice(0, 16);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return true;
  if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return true;
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38) return true;
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return true;
  if (h[0] === 0x42 && h[1] === 0x4D) return true;
  return false;
}

function validateMp3File(data: Buffer, _filename: string): boolean {
  if (data.length < 10) return false;
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true;
  if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true;
  return false;
}

function validateMp4File(data: Buffer, _filename: string): boolean {
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

// GET - list series files (local mode)
export async function GET(request: NextRequest) {
  const localMode = isLocalMode();
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  if (localMode) {
    const dataDir = getLocalDataDir();
    const seriesDir = path.join(dataDir, 'uploads', `series/${categoryCode}/${serieNumber}`);
    const result = { path: `series/${categoryCode}/${serieNumber}`, images: [] as string[], audio: [] as string[], video: [] as string[], responses: [] as string[], exists: false };

    const subDirs = [
      { key: 'images' as const, folder: `${seriesDir}/images`, exts: /\.(png|jpg|jpeg|gif|webp|bmp)$/i },
      { key: 'audio' as const, folder: `${seriesDir}/audio`, exts: /\.mp3$/i },
      { key: 'video' as const, folder: `${seriesDir}/video`, exts: /\.mp4$/i },
      { key: 'responses' as const, folder: `${seriesDir}/responses`, exts: /\.(png|jpg|jpeg|gif|webp|bmp)$/i },
    ];

    for (const sub of subDirs) {
      try {
        if (fs.existsSync(sub.folder)) {
          const files = fs.readdirSync(sub.folder).filter(f => sub.exts.test(f));
          if (files.length > 0) result.exists = true;
          (result as Record<string, string[]>)[sub.key] = files;
        }
      } catch {}
    }

    return NextResponse.json(result);
  }

  // Cloud mode
  const storagePrefix = `series/${categoryCode}/${serieNumber}`;
  const result = { path: storagePrefix, images: [] as string[], audio: [] as string[], video: [] as string[], responses: [] as string[], exists: false };

  try {
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
  } catch {}

  return NextResponse.json(result);
}
