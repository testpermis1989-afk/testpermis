import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

// Store upload jobs in memory
const uploadJobs = new Map<string, { tempPath: string; categoryCode: string; serieNumber: string; fileName: string; fileSize: string; verified: boolean }>();

// POST /api/upload/rar - Upload, verify and extract ZIP file
export async function POST(request: NextRequest) {
  try {
    // Check if this is a JSON request (import from existing file)
    const contentType = request.headers.get('content-type') || '';
    let importId: string | null = null;
    let file: File | null = null;
    let categoryCode: string | null = null;
    let serieNumber: string | null = null;
    let verifyOnly = false;

    if (contentType.includes('application/json')) {
      // JSON request: import from already uploaded file
      const body = await request.json();
      importId = body.importId || null;
      categoryCode = body.category || null;
      serieNumber = body.serie || null;
      verifyOnly = false;
    } else {
      // FormData request: new upload or verification
      const formData = await request.formData();
      file = formData.get('file') as File;
      categoryCode = formData.get('category') as string;
      serieNumber = formData.get('serie') as string;
      verifyOnly = formData.get('verifyOnly') === 'true';
      importId = formData.get('importId') as string;
    }

    // MODE 2: Import from already uploaded file (no re-upload!)
    if (importId && uploadJobs.has(importId)) {
      const job = uploadJobs.get(importId)!;
      if (!existsSync(job.tempPath)) {
        uploadJobs.delete(importId);
        return NextResponse.json({ error: 'Fichier expiré, veuillez ré-uploader' }, { status: 400 });
      }

      try {
        const verification = await verifyZipFile(job.tempPath);
        if (!verification.isValid) {
          if (existsSync(job.tempPath)) await unlink(job.tempPath);
          uploadJobs.delete(importId);
          return NextResponse.json({ success: false, error: 'La vérification a échoué', verification }, { status: 400 });
        }

        const result = await extractAndImport(job.tempPath, job.categoryCode, parseInt(job.serieNumber));
        uploadJobs.delete(importId);
        return NextResponse.json({ success: true, ...result });
      } catch (error) {
        uploadJobs.delete(importId);
        return NextResponse.json({ error: 'Import failed: ' + (error as Error).message }, { status: 500 });
      }
    }

    if (!file || !categoryCode || !serieNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.zip')) {
      return NextResponse.json({ error: 'Seuls les fichiers ZIP sont acceptés' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber);
    const jobId = randomUUID();
    const tempPath = path.join(uploadDir, `temp_${jobId}.zip`);

    await mkdir(uploadDir, { recursive: true });

    // Save uploaded file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempPath, buffer);

    // Verify ZIP
    let verification;
    try {
      verification = await verifyZipFile(tempPath);
    } catch (error) {
      if (existsSync(tempPath)) await unlink(tempPath);
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

    // Keep file on server for later import (no re-upload needed!)
    uploadJobs.set(jobId, {
      tempPath,
      categoryCode,
      serieNumber,
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      verified: verification.isValid,
    });

    // Auto-cleanup after 10 minutes
    setTimeout(() => {
      if (uploadJobs.has(jobId)) {
        const job = uploadJobs.get(jobId)!;
        if (existsSync(job.tempPath)) unlink(job.tempPath).catch(() => {});
        uploadJobs.delete(jobId);
      }
    }, 10 * 60 * 1000);

    if (verifyOnly) {
      return NextResponse.json({
        success: true,
        mode: 'verification',
        importId: jobId,
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        verification
      });
    }

    // Direct import (no verification step)
    if (!verification.isValid) {
      if (existsSync(tempPath)) await unlink(tempPath);
      uploadJobs.delete(jobId);
      return NextResponse.json({ success: false, error: 'La vérification a échoué', verification }, { status: 400 });
    }

    const result = await extractAndImport(tempPath, categoryCode, parseInt(serieNumber));
    uploadJobs.delete(jobId);
    return NextResponse.json({ success: true, ...result });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + (error as Error).message }, { status: 500 });
  }
}

// Extract ZIP and import to database
async function extractAndImport(tempPath: string, categoryCode: string, serieNumber: number) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber.toString());
  const imagesDir = path.join(uploadDir, 'images');
  const audioDir = path.join(uploadDir, 'audio');
  const videoDir = path.join(uploadDir, 'video');
  const responsesDir = path.join(uploadDir, 'responses');

  await mkdir(imagesDir, { recursive: true });
  await mkdir(audioDir, { recursive: true });
  await mkdir(videoDir, { recursive: true });
  await mkdir(responsesDir, { recursive: true });

  let extractedFiles = { images: 0, audio: 0, video: 0, responses: 0, txtFile: false as string | false };
  let questionsImported = 0;

  try {
    const zip = new AdmZip(tempPath);
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
        const txtPath = path.join(uploadDir, baseNameOriginal);
        zip.extractEntryTo(entry, uploadDir, false, true);
        extractedFiles.txtFile = txtPath;
        continue;
      }

      if (isQuestionImage(entryName, entryNameFull)) {
        zip.extractEntryTo(entry, imagesDir, false, true);
        extractedFiles.images++;
        continue;
      }
      if (isResponseImage(entryName, entryNameFull)) {
        zip.extractEntryTo(entry, responsesDir, false, true);
        extractedFiles.responses++;
        continue;
      }
      if (isAudioFile(entryName, entryNameFull)) {
        zip.extractEntryTo(entry, audioDir, false, true);
        extractedFiles.audio++;
        continue;
      }
      if (isVideoFile(entryName, entryNameFull)) {
        zip.extractEntryTo(entry, videoDir, false, true);
        extractedFiles.video++;
        continue;
      }
    }

    if (extractedFiles.txtFile && typeof extractedFiles.txtFile === 'string') {
      questionsImported = await processTxtFile(extractedFiles.txtFile, categoryCode, serieNumber);
      await unlink(extractedFiles.txtFile);
    }
  } finally {
    if (existsSync(tempPath)) await unlink(tempPath);
  }

  return {
    message: 'Fichier traité avec succès!',
    fileName: path.basename(tempPath),
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

// Verify ZIP file
async function verifyZipFile(zipPath: string) {
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
    zip = new AdmZip(zipPath);
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

  // Auto-detect parent folder
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

    // TXT file
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

  // Parse TXT
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
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return true; // PNG
  if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return true; // JPEG
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38) return true; // GIF
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return true; // WebP
  if (h[0] === 0x42 && h[1] === 0x4D) return true; // BMP
  return false;
}

function validateMp3File(data: Buffer, filename: string): boolean {
  if (data.length < 10) return false;
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true; // ID3
  if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true; // MP3 sync
  return false;
}

function validateMp4File(data: Buffer, filename: string): boolean {
  if (data.length < 12) return false;
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true; // ftyp
  if (data[4] === 0x6D && data[5] === 0x6F && data[6] === 0x6F && data[7] === 0x76) return true; // moov
  if (data[4] === 0x6D && data[5] === 0x64 && data[6] === 0x61 && data[7] === 0x74) return true; // mdat
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

async function processTxtFile(txtPath: string, categoryCode: string, serieNumber: number): Promise<number> {
  const { readFile } = await import('fs/promises');
  const content = await readFile(txtPath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

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

    const imagesDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber.toString(), 'images');
    const responsesDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber.toString(), 'responses');
    const audioDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber.toString(), 'audio');
    const videoDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber.toString(), 'video');

    const imageFile = await findRealFile(imagesDir, questionNumber, ['q', '']);
    const responseFile = await findRealFile(responsesDir, questionNumber, ['r', 'R']);
    const audioFile = await findRealFile(audioDir, questionNumber, ['q', '']);
    const videoFile = await findRealFile(videoDir, questionNumber, ['q', '']);

    const question = await db.question.create({
      data: {
        serieId: serie.id,
        order: questionNumber,
        image: imageFile ? `/uploads/${categoryCode}/${serieNumber}/images/${imageFile}` : '',
        audio: audioFile ? `/uploads/${categoryCode}/${serieNumber}/audio/${audioFile}` : '',
        video: videoFile ? `/uploads/${categoryCode}/${serieNumber}/video/${videoFile}` : null,
        text: responseFile ? `/uploads/${categoryCode}/${serieNumber}/responses/${responseFile}` : '',
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

// Trouver le vrai nom de fichier sur disque (ex: "6.png", "q6.webp", "r6.png")
async function findRealFile(dir: string, num: number, prefixes: string[]): Promise<string | null> {
  if (!existsSync(dir)) return null;
  try {
    const files = await readdir(dir);
    const numStr = String(num);
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'mp3', 'mp4'];

    for (const prefix of prefixes) {
      const baseName = prefix ? `${prefix}${numStr}` : numStr;
      for (const file of files) {
        const lowerFile = file.toLowerCase();
        // Match: baseName.ext (ex: "q6.png" ou "6.png" ou "q6.webp")
        for (const ext of imageExts) {
          if (lowerFile === `${baseName.toLowerCase()}.${ext}`) {
            return file; // Retourner le nom réel du fichier
          }
        }
      }
    }
  } catch {}
  return null;
}

async function findFileExtension(dir: string, baseName: string): Promise<string | null> {
  if (!existsSync(dir)) return null;
  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (file.toLowerCase().startsWith(baseName.toLowerCase() + '.')) {
        return file.split('.').pop() || null;
      }
    }
    const letterMatch = baseName.match(/^[qr](\d+)$/i);
    if (letterMatch) {
      const numPrefix = letterMatch[1] + '.';
      for (const file of files) {
        const lowerFile = file.toLowerCase();
        if (lowerFile.startsWith(numPrefix) && /^[\d]/.test(file)) {
          return file.split('.').pop() || null;
        }
      }
    }
  } catch {}
  return null;
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

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber);
  const result = { path: `/uploads/${categoryCode}/${serieNumber}/`, images: [] as string[], audio: [] as string[], video: [] as string[], responses: [] as string[], exists: existsSync(uploadDir) };

  if (result.exists) {
    try {
      const dirs = { images: 'images', audio: 'audio', video: 'video', responses: 'responses' } as const;
      const exts = { images: /\.(png|jpg|jpeg|gif|webp|bmp)$/i, audio: /\.mp3$/i, video: /\.mp4$/i, responses: /\.(png|jpg|jpeg|gif|webp|bmp)$/i };
      for (const [key, dir] of Object.entries(dirs)) {
        const fullPath = path.join(uploadDir, dir);
        if (existsSync(fullPath)) {
          const files = await readdir(fullPath);
          (result as Record<string, string[]>)[key] = files.filter(f => exts[key as keyof typeof exts].test(f));
        }
      }
    } catch {}
  }

  return NextResponse.json(result);
}
