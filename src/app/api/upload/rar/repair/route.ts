import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { getUploadBuffer, hasUploadJob, saveUploadJob } from '@/lib/upload-store';

// Lazy load Jimp - 100% JavaScript, works in Electron without native binaries
let jimpModule: any = null;
function getJimp() {
  if (!jimpModule) {
    try {
      jimpModule = require('jimp');
      if (!jimpModule.Jimp) jimpModule = null;
    } catch (e) {
      console.warn('[jimp] Module not available:', (e as Error).message);
    }
  }
  return jimpModule;
}

// Helper: compress/repair image using Jimp v1.x API
async function jimpCompress(fileData: Buffer): Promise<Buffer | null> {
  const JimpMod = getJimp();
  if (!JimpMod) return null;
  try {
    const Jimp = JimpMod.Jimp;
    const image = await Jimp.read(fileData);
    image.scaleToFit({ w: 1024, h: 1024 });
    const outputBuffer = await image.getBuffer('image/jpeg');
    return outputBuffer;
  } catch {
    return null;
  }
}

// Check if we're in desktop/local mode
function isLocalMode(): boolean {
  return (process.env.STORAGE_MODE || '') === 'local' || !!(process.env.DATABASE_URL || '').includes('file:');
}

function getLocalDataDir(): string {
  return process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
}

// POST /api/upload/rar/repair - Réparer les fichiers corrompus et importer
// Desktop mode (FormData): reçoit ZIP + category + serie → répare → importe directement sur disque
// Cloud mode (JSON): reçoit importId → répare → retourne ZIP base64
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data') && isLocalMode()) {
      // ====================================================================
      // DESKTOP MODE: Repair + Import directly to local filesystem
      // ====================================================================
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const categoryCode = formData.get('category') as string;
      const serieNumber = formData.get('serie') as string;

      if (!file || !categoryCode || !serieNumber) {
        return NextResponse.json({ error: 'Champs manquants (file, category, serie)' }, { status: 400 });
      }

      const zipBuffer = Buffer.from(await file.arrayBuffer());
      const result = await repairAndImportLocal(zipBuffer, categoryCode, parseInt(serieNumber));

      return NextResponse.json({
        success: true,
        mode: 'desktop',
        ...result,
      });
    } else {
      // ====================================================================
      // CLOUD MODE: Repair and return ZIP as base64
      // ====================================================================
      const body = await request.json();
      const importId = body.importId;
      const zipBufferBase64 = body.zipBuffer;

      let zipBuffer: Buffer;
      if (zipBufferBase64) {
        zipBuffer = Buffer.from(zipBufferBase64, 'base64');
      } else if (importId) {
        const jobExists = await hasUploadJob(importId);
        if (!jobExists) {
          return NextResponse.json({ error: 'Fichier expiré, veuillez ré-uploader' }, { status: 400 });
        }
        const buffer = await getUploadBuffer(importId);
        if (!buffer) {
          return NextResponse.json({ error: 'Fichier introuvable' }, { status: 400 });
        }
        zipBuffer = buffer;
      } else {
        return NextResponse.json({ error: 'Missing importId or zipBuffer or file' }, { status: 400 });
      }

      const { report, repairedBuffer } = await repairZipBuffer(zipBuffer);

      // Save repaired ZIP back to temp storage
      if (importId) {
        try {
          const { getUploadJob } = await import('@/lib/upload-store');
          const job = await getUploadJob(importId);
          if (job) await saveUploadJob(importId, repairedBuffer, job);
        } catch {}
      }

      return NextResponse.json({
        success: true,
        mode: 'cloud',
        report,
        summary: {
          totalRepaired: report.repaired.length,
          totalRemoved: report.removed.length,
          totalSkipped: report.skipped.length,
        },
        zipBuffer: repairedBuffer.toString('base64'),
      });
    }
  } catch (error) {
    console.error('Repair error:', error);
    return NextResponse.json({ error: 'Réparation échouée: ' + (error as Error).message }, { status: 500 });
  }
}

// =====================================================================
// DESKTOP MODE: Repair ZIP + Import directly to local filesystem
// =====================================================================
async function repairAndImportLocal(zipBuffer: Buffer, categoryCode: string, serieNumber: number) {
  const dataDir = getLocalDataDir();
  const seriesDir = path.join(dataDir, 'uploads', `series/${categoryCode}/${serieNumber}`);

  const report = {
    repaired: [] as string[],
    removed: [] as string[],
    skipped: [] as string[],
  };

  const extractedFiles = { images: 0, audio: 0, video: 0, responses: 0, compressed: 0, savedBytes: 0 };
  let fileErrors: string[] = [];
  let diskStats = { imagesFound: 0, audioFound: 0, videoFound: 0, responsesFound: 0 };

  try {
    // Clean existing directory (overwrite mode)
    if (fs.existsSync(seriesDir)) {
      try { fs.rmSync(seriesDir, { recursive: true, force: true }); } catch {}
    }
    fs.mkdirSync(seriesDir, { recursive: true });

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

    let txtContent = '';

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

      // TXT file
      if (entryName.endsWith('.txt') && (
        entryName.includes('reponse') || entryName.includes('response') ||
        entryName.includes('answer') || entryName.includes('question') ||
        entryName === 'data.txt' || entryName.match(/^[^\/]+\.txt$/) ||
        baseNameOriginal.toLowerCase().startsWith('repons') ||
        baseNameOriginal.toLowerCase().startsWith('answer') ||
        baseNameOriginal.toLowerCase() === 'data.txt'
      )) {
        txtContent = fileData.toString('utf-8');
        continue;
      }

      try {
        // Images
        const imgExts = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.webp'];
        const ext = path.extname(entryName).toLowerCase();

        if (imgExts.includes(ext) && isQuestionImageEntry(entryName, entryNameFull)) {
          const qNum = extractQuestionNumber(baseNameOriginal);
          const dirPath = path.join(seriesDir, 'images');
          fs.mkdirSync(dirPath, { recursive: true });

          const isCorrupted = !isValidImage(fileData);
          const targetName = qNum ? `q${qNum}${ext}` : baseNameOriginal;

          if (isCorrupted) {
            // Try to repair with Jimp
            const outputBuffer = await jimpCompress(fileData);
            if (outputBuffer && outputBuffer.length > 0) {
              const jpgName = qNum ? `q${qNum}.jpg` : baseNameOriginal.replace(/\.[^.]+$/, '.jpg');
              fs.writeFileSync(path.join(dirPath, jpgName), outputBuffer);
              report.repaired.push(`${baseNameOriginal} → Image réparée ✓`);
              extractedFiles.compressed++;
            } else {
              report.removed.push(`${baseNameOriginal} — Image irréparable`);
              continue;
            }
          } else {
            // Compress valid image
            const outputBuffer = await jimpCompress(fileData);
            if (outputBuffer && outputBuffer.length > 0 && outputBuffer.length < fileData.length) {
              const jpgName = qNum ? `q${qNum}.jpg` : baseNameOriginal.replace(/\.[^.]+$/, '.jpg');
              fs.writeFileSync(path.join(dirPath, jpgName), outputBuffer);
              extractedFiles.compressed++;
              extractedFiles.savedBytes += (fileData.length - outputBuffer.length);
            } else {
              fs.writeFileSync(path.join(dirPath, targetName), fileData);
            }
          }
          extractedFiles.images++;
          continue;
        }

        // Response images
        if (imgExts.includes(ext) && isResponseImageEntry(entryName, entryNameFull)) {
          const rNum = extractResponseNumber(baseNameOriginal);
          const dirPath = path.join(seriesDir, 'responses');
          fs.mkdirSync(dirPath, { recursive: true });

          const isCorrupted = !isValidImage(fileData);
          const targetName = rNum ? `r${rNum}${ext}` : baseNameOriginal;

          if (isCorrupted) {
            const outputBuffer = await jimpCompress(fileData);
            if (outputBuffer && outputBuffer.length > 0) {
              const jpgName = rNum ? `r${rNum}.jpg` : baseNameOriginal.replace(/\.[^.]+$/, '.jpg');
              fs.writeFileSync(path.join(dirPath, jpgName), outputBuffer);
              report.repaired.push(`${baseNameOriginal} → Image réponse réparée ✓`);
              extractedFiles.compressed++;
            } else {
              report.removed.push(`${baseNameOriginal} — Image réponse irréparable`);
              continue;
            }
          } else {
            const outputBuffer = await jimpCompress(fileData);
            if (outputBuffer && outputBuffer.length > 0 && outputBuffer.length < fileData.length) {
              const jpgName = rNum ? `r${rNum}.jpg` : baseNameOriginal.replace(/\.[^.]+$/, '.jpg');
              fs.writeFileSync(path.join(dirPath, jpgName), outputBuffer);
              extractedFiles.compressed++;
              extractedFiles.savedBytes += (fileData.length - outputBuffer.length);
            } else {
              fs.writeFileSync(path.join(dirPath, targetName), fileData);
            }
          }
          extractedFiles.responses++;
          continue;
        }

        // Audio
        if (ext === '.mp3' && isAudioEntry(entryName, entryNameFull)) {
          const qNum = extractQuestionNumber(baseNameOriginal);
          const dirPath = path.join(seriesDir, 'audio');
          fs.mkdirSync(dirPath, { recursive: true });
          const saveName = qNum ? `q${qNum}.mp3` : baseNameOriginal;

          if (isValidMp3(fileData) || fileData.length > 1000) {
            fs.writeFileSync(path.join(dirPath, saveName), fileData);
            extractedFiles.audio++;
          } else {
            report.removed.push(`${baseNameOriginal} — Audio corrompu`);
          }
          continue;
        }

        // Video
        if (ext === '.mp4' && isVideoEntry(entryName, entryNameFull)) {
          const qNum = extractQuestionNumber(baseNameOriginal);
          const dirPath = path.join(seriesDir, 'video');
          fs.mkdirSync(dirPath, { recursive: true });
          const saveName = qNum ? `q${qNum}.mp4` : baseNameOriginal;

          if (isValidMp4(fileData) || fileData.length > 10000) {
            fs.writeFileSync(path.join(dirPath, saveName), fileData);
            extractedFiles.video++;
          } else {
            report.removed.push(`${baseNameOriginal} — Vidéo corrompue`);
          }
          continue;
        }
      } catch (fileErr) {
        fileErrors.push(`Error saving ${baseNameOriginal}: ${fileErr}`);
      }
    }

    // Scan extracted files on disk
    const imageFiles = scanDir(path.join(seriesDir, 'images'), ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'], extractQuestionNumber);
    const audioFiles = scanDir(path.join(seriesDir, 'audio'), ['.mp3', '.wav', '.ogg'], extractQuestionNumber);
    const responseFiles = scanDir(path.join(seriesDir, 'responses'), ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'], extractResponseNumber);
    const videoFiles = scanDir(path.join(seriesDir, 'video'), ['.mp4', '.webm', '.avi'], extractQuestionNumber);

    // Verify files on disk
    for (const sub of ['images', 'audio', 'video', 'responses'] as const) {
      const subDir = path.join(seriesDir, sub);
      if (fs.existsSync(subDir)) {
        const files = fs.readdirSync(subDir);
        if (sub === 'images') diskStats.imagesFound = files.length;
        else if (sub === 'audio') diskStats.audioFound = files.length;
        else if (sub === 'video') diskStats.videoFound = files.length;
        else diskStats.responsesFound = files.length;
      }
    }

    // Process TXT and save questions
    let questionsImported = 0;
    if (txtContent) {
      questionsImported = await processTxtAndSaveQuestions(txtContent, categoryCode, serieNumber, {
        imageFiles, audioFiles, responseFiles, videoFiles,
      });
    }

    const formatSize = (b: number) => {
      if (b < 1024) return b + ' B';
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
      return (b / 1024 / 1024).toFixed(2) + ' MB';
    };

    return {
      report,
      extracted: {
        images: extractedFiles.images,
        audio: extractedFiles.audio,
        video: extractedFiles.video,
        responses: extractedFiles.responses,
        txtProcessed: !!txtContent,
      },
      compression: {
        imagesCompressed: extractedFiles.compressed,
        savedBytes: extractedFiles.savedBytes,
        savedFormatted: formatSize(extractedFiles.savedBytes),
      },
      questionsImported,
      diskStats,
      fileErrors: fileErrors.length > 0 ? fileErrors : undefined,
    };
  } catch (error) {
    console.error('Repair+Import error:', error);
    throw error;
  }
}

// Process TXT and save questions to JSON + DB
async function processTxtAndSaveQuestions(txtContent: string, categoryCode: string, serieNumber: number, fileNames: {
  imageFiles: Map<number, string>;
  audioFiles: Map<number, string>;
  responseFiles: Map<number, string>;
  videoFiles: Map<number, string>;
}): Promise<number> {
  const lines = txtContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const questions: { order: number; imageUrl: string; audioUrl: string; videoUrl: string | null; responseImageUrl: string; correctAnswers: string }[] = [];

  for (const line of lines) {
    const parts = line.split(/[\t\s,;]+/).filter(p => p);
    if (parts.length < 2) continue;
    const questionNumber = parseInt(parts[0]);
    const correctAnswers = parts[1];
    if (isNaN(questionNumber)) continue;

    const imgFile = fileNames.imageFiles.get(questionNumber);
    const audFile = fileNames.audioFiles.get(questionNumber);
    const resFile = fileNames.responseFiles.get(questionNumber);
    const vidFile = fileNames.videoFiles.get(questionNumber);

    questions.push({
      order: questionNumber,
      imageUrl: imgFile ? `/api/serve/series/${categoryCode}/${serieNumber}/images/${imgFile}` : `/api/serve/series/${categoryCode}/${serieNumber}/images/q${questionNumber}.png`,
      audioUrl: audFile ? `/api/serve/series/${categoryCode}/${serieNumber}/audio/${audFile}` : `/api/serve/series/${categoryCode}/${serieNumber}/audio/q${questionNumber}.mp3`,
      videoUrl: vidFile ? `/api/serve/series/${categoryCode}/${serieNumber}/video/${vidFile}` : null,
      responseImageUrl: resFile ? `/api/serve/series/${categoryCode}/${serieNumber}/responses/${resFile}` : `/api/serve/series/${categoryCode}/${serieNumber}/responses/r${questionNumber}.png`,
      correctAnswers,
    });
  }

  if (questions.length === 0) return 0;

  // Save to JSON file
  const { saveSerieQuestions } = await import('@/lib/series-file');
  const jsonResult = saveSerieQuestions(categoryCode, serieNumber, questions);
  console.log(`[Repair+Import] Saved ${jsonResult.questionsImported} questions to JSON`);

  // Also try DB
  try {
    const { db } = await import('@/lib/db');
    let category = await db.category.findUnique({ where: { code: categoryCode } });
    if (!category) {
      category = await db.category.create({ data: { code: categoryCode, name: getCategoryName(categoryCode), nameAr: getCategoryNameAr(categoryCode) } });
    }
    let serie = await db.serie.findFirst({ where: { categoryId: category.id, number: serieNumber } });
    if (!serie) {
      serie = await db.serie.create({ data: { categoryId: category.id, number: serieNumber } });
    }
    const existingQuestions = await db.question.findMany({ where: { serieId: serie.id } });
    for (const q of existingQuestions as any[]) {
      try { await db.response.deleteMany({ where: { questionId: q.id } }); } catch {}
    }
    await db.question.deleteMany({ where: { serieId: serie.id } });

    let imported = 0;
    for (const q of questions) {
      try {
        const question = await db.question.create({
          data: { serieId: serie.id, order: q.order, image: q.imageUrl, audio: q.audioUrl, video: q.videoUrl || null, text: q.responseImageUrl || '' },
        });
        for (let j = 1; j <= 4; j++) {
          await db.response.create({
            data: { questionId: question.id, order: j, text: `Réponse ${j}`, isCorrect: q.correctAnswers.includes(String(j)) },
          });
        }
        imported++;
      } catch {}
    }
    try { await db.serie.update({ where: { id: serie.id }, data: { questionsCount: imported } }); } catch {}
  } catch (dbErr) {
    console.log('[Repair+Import] DB save failed (JSON is primary):', dbErr);
  }

  return questions.length;
}

// =====================================================================
// CLOUD MODE: Repair ZIP buffer and return new ZIP
// =====================================================================
async function repairZipBuffer(zipBuffer: Buffer): Promise<{ report: typeof report; repairedBuffer: Buffer }> {
  const report = {
    repaired: [] as string[],
    removed: [] as string[],
    skipped: [] as string[],
  };

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const topLevelDirs = new Set<string>();
  for (const entry of entries) {
    const parts = entry.entryName.split('/').filter(Boolean);
    if (parts.length >= 2) topLevelDirs.add(parts[0].toLowerCase());
  }
  let stripParent = '';
  if (topLevelDirs.size === 1) stripParent = [...topLevelDirs][0] + '/';

  const newZip = new AdmZip();

  for (const entry of entries) {
    if (entry.isDirectory) {
      newZip.addFile(entry.entryName, Buffer.alloc(0));
      continue;
    }

    let entryName = entry.entryName;
    if (stripParent && entryName.startsWith(stripParent)) {
      entryName = entryName.substring(stripParent.length);
    }

    const ext = path.extname(entryName).toLowerCase();
    const baseName = path.basename(entryName);
    const dirName = entryName.substring(0, entryName.length - baseName.length);
    let fileData = entry.getData();

    // Images
    if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif'].includes(ext)) {
      if (isValidImage(fileData)) {
        newZip.addFile(entry.entryName, fileData);
        continue;
      }
      const outputBuffer = await jimpCompress(fileData);
      if (outputBuffer && outputBuffer.length > 0) {
        const newBaseName = baseName.replace(/\.[^.]+$/, '.jpg');
        newZip.addFile(stripParent + dirName + newBaseName, outputBuffer);
        report.repaired.push(`${baseName} → Image réparée ✓`);
      } else {
        report.removed.push(`${baseName} — Image irréparable`);
      }
      continue;
    }

    // Audio
    if (ext === '.mp3') {
      if (isValidMp3(fileData)) {
        newZip.addFile(entry.entryName, fileData);
      } else if (fileData.length > 1000) {
        newZip.addFile(entry.entryName, fileData);
        report.skipped.push(`${baseName} — Audio conservé`);
      } else {
        report.removed.push(`${baseName} — Audio corrompu`);
      }
      continue;
    }

    // Video
    if (ext === '.mp4') {
      if (isValidMp4(fileData)) {
        newZip.addFile(entry.entryName, fileData);
      } else if (fileData.length > 10000) {
        newZip.addFile(entry.entryName, fileData);
        report.skipped.push(`${baseName} — Vidéo conservée`);
      } else {
        report.removed.push(`${baseName} — Vidéo corrompue`);
      }
      continue;
    }

    newZip.addFile(entry.entryName, fileData);
  }

  return { report, repairedBuffer: newZip.toBuffer() };
}

// =====================================================================
// FILE HELPERS
// =====================================================================
function isValidImage(data: Buffer): boolean {
  if (data.length < 8) return false;
  const h = data.slice(0, 16);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return true;
  if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return true;
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38) return true;
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return true;
  if (h[0] === 0x42 && h[1] === 0x4D) return true;
  return false;
}

function isValidMp3(data: Buffer): boolean {
  if (data.length < 10) return false;
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true;
  if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true;
  return false;
}

function isValidMp4(data: Buffer): boolean {
  if (data.length < 12) return false;
  const ftyp = data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
  const moov = data[4] === 0x6D && data[5] === 0x6F && data[6] === 0x6F && data[7] === 0x76;
  const mdat = data[4] === 0x6D && data[5] === 0x64 && data[6] === 0x61 && data[7] === 0x74;
  const ftyp0 = data[0] === 0x66 && data[1] === 0x74 && data[2] === 0x79 && data[3] === 0x70;
  return ftyp || moov || mdat || ftyp0;
}

function extractQuestionNumber(filename: string): number | null {
  const match = filename.match(/(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function extractResponseNumber(filename: string): number | null {
  const match = filename.match(/r(\d+)/i);
  return match ? parseInt(match[1]) : extractQuestionNumber(filename);
}

function scanDir(dirPath: string, validExts: string[], numExtractor: (filename: string) => number | null): Map<number, string> {
  const filenames = new Map<number, string>();
  try {
    if (!fs.existsSync(dirPath)) return filenames;
    for (const f of fs.readdirSync(dirPath)) {
      const ext = path.extname(f).toLowerCase();
      if (!validExts.includes(ext)) continue;
      const num = numExtractor(f);
      if (num !== null && !filenames.has(num)) filenames.set(num, f);
    }
  } catch {}
  return filenames;
}

function isQuestionImageEntry(entryName: string, entryNameOriginal: string): boolean {
  const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
  if (!exts.some(ext => entryName.endsWith(ext))) return false;
  if (entryName.includes('images/') || entryName.includes('image/') || entryName.includes('questions/')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  if (/^q\d+/i.test(base) || /^\d+\./.test(base)) return true;
  return false;
}

function isResponseImageEntry(entryName: string, entryNameOriginal: string): boolean {
  const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
  if (!exts.some(ext => entryName.endsWith(ext))) return false;
  if (entryName.includes('responses/') || entryName.includes('response/') || entryName.includes('reponses/') || entryName.includes('reponse/')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  if (/^r\d+/i.test(base)) return true;
  return false;
}

function isAudioEntry(entryName: string, entryNameOriginal: string): boolean {
  if (!entryName.endsWith('.mp3')) return false;
  if (entryName.includes('audio/') || entryName.includes('son/')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  if (/^q\d+/i.test(base) || /^\d+\.mp3$/i.test(base)) return true;
  return false;
}

function isVideoEntry(entryName: string, entryNameOriginal: string): boolean {
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
