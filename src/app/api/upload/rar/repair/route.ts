import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { getUploadBuffer, hasUploadJob, saveUploadJob } from '@/lib/upload-store';
import { compressMp3, compressMp4 } from '@/lib/media-compress';
import { encryptDirectory } from '@/lib/file-encryption';

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// POST /api/upload/rar/repair
// step=prepare: Repair + compress files, return file details + repaired ZIP (NO import)
// step=import: Import a previously repaired ZIP (receives base64 zipBuffer + category + serie)
// step=full: (legacy) Repair + compress + import in one shot
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data') && isLocalMode()) {
      // ====================================================================
      // DESKTOP MODE
      // ====================================================================
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const categoryCode = formData.get('category') as string;
      const serieNumber = formData.get('serie') as string;
      const step = formData.get('step') as string || 'prepare'; // prepare | import

      if (!file) {
        return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
      }

      const zipBuffer = Buffer.from(await file.arrayBuffer());

      if (step === 'prepare') {
        // STEP 1: Repair + compress, return details, do NOT import
        const result = await repairAndPrepare(zipBuffer, categoryCode);
        return NextResponse.json({
          success: true,
          mode: 'desktop',
          step: 'prepare',
          ...result,
        });
      } else if (step === 'import') {
        // STEP 2: Import the repaired ZIP
        if (!categoryCode || !serieNumber) {
          return NextResponse.json({ error: 'Catégorie et série requis pour l\'import' }, { status: 400 });
        }
        const result = await importRepairedZip(zipBuffer, categoryCode, parseInt(serieNumber));
        return NextResponse.json({
          success: true,
          mode: 'desktop',
          step: 'import',
          ...result,
        });
      } else {
        // Legacy: full repair + import in one shot
        if (!categoryCode || !serieNumber) {
          return NextResponse.json({ error: 'Champs manquants (category, serie)' }, { status: 400 });
        }
        const result = await repairAndImportLocal(zipBuffer, categoryCode, parseInt(serieNumber));
        return NextResponse.json({
          success: true,
          mode: 'desktop',
          step: 'full',
          ...result,
        });
      }
    } else {
      // ====================================================================
      // CLOUD MODE
      // ====================================================================
      const body = await request.json();
      const importId = body.importId;
      const zipBufferBase64 = body.zipBuffer;
      const categoryCode = body.category;
      const serieNumber = body.serie;
      const step = body.step || 'prepare';

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

      if (step === 'prepare') {
        const result = await repairAndPrepare(zipBuffer, categoryCode);
        return NextResponse.json({
          success: true,
          mode: 'cloud',
          step: 'prepare',
          ...result,
        });
      } else if (step === 'import' && categoryCode && serieNumber) {
        const result = await importRepairedZip(zipBuffer, categoryCode, parseInt(serieNumber));
        return NextResponse.json({
          success: true,
          mode: 'cloud',
          step: 'import',
          ...result,
        });
      } else {
        // Legacy cloud mode: repair only
        const { report, repairedBuffer } = await repairZipBuffer(zipBuffer);
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
          step: 'legacy',
          report,
          summary: {
            totalRepaired: report.repaired.length,
            totalRemoved: report.removed.length,
            totalSkipped: report.skipped.length,
          },
          zipBuffer: repairedBuffer.toString('base64'),
        });
      }
    }
  } catch (error) {
    console.error('Repair error:', error);
    return NextResponse.json({ error: 'Réparation échouée: ' + (error as Error).message }, { status: 500 });
  }
}

// =====================================================================
// STEP 1: Repair + Compress WITHOUT importing
// Returns detailed file list with sizes and statuses
// =====================================================================
async function repairAndPrepare(zipBuffer: Buffer, categoryCode?: string) {
  const report = {
    repaired: [] as string[],
    removed: [] as string[],
    skipped: [] as string[],
  };

  // Detailed file list for the UI
  const fileDetails: {
    name: string;
    type: 'image' | 'audio' | 'video' | 'response' | 'text';
    status: 'ok' | 'repaired' | 'removed' | 'skipped' | 'compressed';
    sizeBefore: number;
    sizeAfter: number;
    questionNum?: number;
  }[] = [];

  let totalBefore = 0;
  let totalAfter = 0;
  let compressedCount = 0;

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

  const newZip = new AdmZip();

  // Track TXT content for questions count
  let txtContent = '';
  let questionsCount = 0;

  for (const entry of entries) {
    if (entry.isDirectory) {
      newZip.addFile(entry.entryName, Buffer.alloc(0));
      continue;
    }

    let entryNameFull = entry.entryName;
    let entryName = entryNameFull.toLowerCase();
    if (stripParent && entryName.startsWith(stripParent)) {
      entryNameFull = entryNameFull.substring(stripParent.length);
      entryName = entryNameFull.toLowerCase();
    }
    const baseNameOriginal = path.basename(entryNameFull);

    let fileData: Buffer;
    try { fileData = entry.getData(); } catch { continue; }

    const ext = path.extname(entryName).toLowerCase();

    // TXT file
    if (entryName.endsWith('.txt')) {
      try {
        txtContent = fileData.toString('utf-8');
        const lines = txtContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        questionsCount = lines.filter(l => {
          const parts = l.split(/[\t\s,;]+/).filter(p => p);
          return parts.length >= 2 && !isNaN(parseInt(parts[0]));
        }).length;
      } catch {}
      newZip.addFile(entry.entryName, fileData);
      fileDetails.push({
        name: baseNameOriginal,
        type: 'text',
        status: 'ok',
        sizeBefore: fileData.length,
        sizeAfter: fileData.length,
      });
      totalBefore += fileData.length;
      totalAfter += fileData.length;
      continue;
    }

    // Question images
    const imgExts = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.webp'];
    if (imgExts.includes(ext) && isQuestionImageEntry(entryName, entryNameFull)) {
      const qNum = extractQuestionNumber(baseNameOriginal);
      const sizeBefore = fileData.length;
      totalBefore += sizeBefore;
      const isCorrupted = !isValidImage(fileData);

      if (isCorrupted) {
        // Try to repair with Jimp
        const outputBuffer = await jimpCompress(fileData);
        if (outputBuffer && outputBuffer.length > 0) {
          const jpgName = qNum ? `q${qNum}.jpg` : baseNameOriginal.replace(/\.[^.]+$/, '.jpg');
          newZip.addFile(stripParent + (qNum ? 'images/' : '') + jpgName, outputBuffer);
          report.repaired.push(`${baseNameOriginal} → Image réparée ✓`);
          fileDetails.push({
            name: jpgName,
            type: 'image',
            status: 'repaired',
            sizeBefore,
            sizeAfter: outputBuffer.length,
            questionNum: qNum ?? undefined,
          });
          totalAfter += outputBuffer.length;
        } else {
          report.removed.push(`${baseNameOriginal} — Image irréparable`);
          fileDetails.push({
            name: baseNameOriginal,
            type: 'image',
            status: 'removed',
            sizeBefore,
            sizeAfter: 0,
            questionNum: qNum ?? undefined,
          });
        }
      } else {
        // Compress valid image
        const outputBuffer = await jimpCompress(fileData);
        if (outputBuffer && outputBuffer.length > 0 && outputBuffer.length < fileData.length) {
          const jpgName = qNum ? `q${qNum}.jpg` : baseNameOriginal.replace(/\.[^.]+$/, '.jpg');
          newZip.addFile(stripParent + (qNum ? 'images/' : '') + jpgName, outputBuffer);
          compressedCount++;
          fileDetails.push({
            name: jpgName,
            type: 'image',
            status: 'compressed',
            sizeBefore,
            sizeAfter: outputBuffer.length,
            questionNum: qNum ?? undefined,
          });
          totalAfter += outputBuffer.length;
        } else {
          newZip.addFile(entry.entryName, fileData);
          fileDetails.push({
            name: baseNameOriginal,
            type: 'image',
            status: 'ok',
            sizeBefore,
            sizeAfter: sizeBefore,
            questionNum: qNum ?? undefined,
          });
          totalAfter += sizeBefore;
        }
      }
      continue;
    }

    // Response images
    if (imgExts.includes(ext) && isResponseImageEntry(entryName, entryNameFull)) {
      const rNum = extractResponseNumber(baseNameOriginal);
      const sizeBefore = fileData.length;
      totalBefore += sizeBefore;
      const isCorrupted = !isValidImage(fileData);

      if (isCorrupted) {
        const outputBuffer = await jimpCompress(fileData);
        if (outputBuffer && outputBuffer.length > 0) {
          const jpgName = rNum ? `r${rNum}.jpg` : baseNameOriginal.replace(/\.[^.]+$/, '.jpg');
          newZip.addFile(stripParent + (rNum ? 'responses/' : '') + jpgName, outputBuffer);
          report.repaired.push(`${baseNameOriginal} → Image réponse réparée ✓`);
          fileDetails.push({
            name: jpgName,
            type: 'response',
            status: 'repaired',
            sizeBefore,
            sizeAfter: outputBuffer.length,
            questionNum: rNum ?? undefined,
          });
          totalAfter += outputBuffer.length;
        } else {
          report.removed.push(`${baseNameOriginal} — Image réponse irréparable`);
          fileDetails.push({
            name: baseNameOriginal,
            type: 'response',
            status: 'removed',
            sizeBefore,
            sizeAfter: 0,
            questionNum: rNum ?? undefined,
          });
        }
      } else {
        const outputBuffer = await jimpCompress(fileData);
        if (outputBuffer && outputBuffer.length > 0 && outputBuffer.length < fileData.length) {
          const jpgName = rNum ? `r${rNum}.jpg` : baseNameOriginal.replace(/\.[^.]+$/, '.jpg');
          newZip.addFile(stripParent + (rNum ? 'responses/' : '') + jpgName, outputBuffer);
          compressedCount++;
          fileDetails.push({
            name: jpgName,
            type: 'response',
            status: 'compressed',
            sizeBefore,
            sizeAfter: outputBuffer.length,
            questionNum: rNum ?? undefined,
          });
          totalAfter += outputBuffer.length;
        } else {
          newZip.addFile(entry.entryName, fileData);
          fileDetails.push({
            name: baseNameOriginal,
            type: 'response',
            status: 'ok',
            sizeBefore,
            sizeAfter: sizeBefore,
            questionNum: rNum ?? undefined,
          });
          totalAfter += sizeBefore;
        }
      }
      continue;
    }

    // Audio - compress with FFmpeg
    if (ext === '.mp3' && isAudioEntry(entryName, entryNameFull)) {
      const qNum = extractQuestionNumber(baseNameOriginal);
      const sizeBefore = fileData.length;
      totalBefore += sizeBefore;

      if (isValidMp3(fileData) || fileData.length > 1000) {
        // Try to compress MP3
        try {
          const compressed = await compressMp3(fileData);
          if (compressed && compressed.length < fileData.length) {
            const mp3Name = qNum ? `q${qNum}.mp3` : baseNameOriginal;
            newZip.addFile(stripParent + (qNum ? 'audio/' : '') + mp3Name, compressed);
            compressedCount++;
            fileDetails.push({
              name: mp3Name,
              type: 'audio',
              status: 'compressed',
              sizeBefore,
              sizeAfter: compressed.length,
              questionNum: qNum ?? undefined,
            });
            totalAfter += compressed.length;
          } else {
            newZip.addFile(entry.entryName, fileData);
            fileDetails.push({
              name: baseNameOriginal,
              type: 'audio',
              status: 'ok',
              sizeBefore,
              sizeAfter: sizeBefore,
              questionNum: qNum ?? undefined,
            });
            totalAfter += sizeBefore;
          }
        } catch {
          newZip.addFile(entry.entryName, fileData);
          fileDetails.push({
            name: baseNameOriginal,
            type: 'audio',
            status: 'ok',
            sizeBefore,
            sizeAfter: sizeBefore,
            questionNum: qNum ?? undefined,
          });
          totalAfter += sizeBefore;
        }
      } else {
        report.removed.push(`${baseNameOriginal} — Audio corrompu`);
        fileDetails.push({
          name: baseNameOriginal,
          type: 'audio',
          status: 'removed',
          sizeBefore,
          sizeAfter: 0,
          questionNum: qNum ?? undefined,
        });
      }
      continue;
    }

    // Video - compress with FFmpeg
    if (ext === '.mp4' && isVideoEntry(entryName, entryNameFull)) {
      const qNum = extractQuestionNumber(baseNameOriginal);
      const sizeBefore = fileData.length;
      totalBefore += sizeBefore;

      if (isValidMp4(fileData) || fileData.length > 10000) {
        // Try to compress MP4
        try {
          const compressed = await compressMp4(fileData);
          if (compressed && compressed.length < fileData.length) {
            const mp4Name = qNum ? `q${qNum}.mp4` : baseNameOriginal;
            newZip.addFile(stripParent + (qNum ? 'video/' : '') + mp4Name, compressed);
            compressedCount++;
            fileDetails.push({
              name: mp4Name,
              type: 'video',
              status: 'compressed',
              sizeBefore,
              sizeAfter: compressed.length,
              questionNum: qNum ?? undefined,
            });
            totalAfter += compressed.length;
          } else {
            newZip.addFile(entry.entryName, fileData);
            fileDetails.push({
              name: baseNameOriginal,
              type: 'video',
              status: 'ok',
              sizeBefore,
              sizeAfter: sizeBefore,
              questionNum: qNum ?? undefined,
            });
            totalAfter += sizeBefore;
          }
        } catch {
          newZip.addFile(entry.entryName, fileData);
          fileDetails.push({
            name: baseNameOriginal,
            type: 'video',
            status: 'ok',
            sizeBefore,
            sizeAfter: sizeBefore,
            questionNum: qNum ?? undefined,
          });
          totalAfter += sizeBefore;
        }
      } else {
        report.removed.push(`${baseNameOriginal} — Vidéo corrompue`);
        fileDetails.push({
          name: baseNameOriginal,
          type: 'video',
          status: 'removed',
          sizeBefore,
          sizeAfter: 0,
          questionNum: qNum ?? undefined,
        });
      }
      continue;
    }

    // Other files: pass through
    newZip.addFile(entry.entryName, fileData);
  }

  const repairedBuffer = newZip.toBuffer();
  const savedBytes = totalBefore - totalAfter;

  return {
    report,
    questionsCount,
    categoryCode: categoryCode || 'unknown',
    compression: {
      totalBefore,
      totalAfter,
      savedBytes,
      totalBeforeFormatted: formatSize(totalBefore),
      totalAfterFormatted: formatSize(totalAfter),
      savedFormatted: formatSize(savedBytes),
      filesCompressed: compressedCount,
    },
    summary: {
      totalRepaired: report.repaired.length,
      totalRemoved: report.removed.length,
      totalSkipped: report.skipped.length,
    },
    fileDetails,
    repairedZipBase64: repairedBuffer.toString('base64'),
  };
}

// =====================================================================
// STEP 2: Import a repaired ZIP (from step=prepare result)
// =====================================================================
async function importRepairedZip(zipBuffer: Buffer, categoryCode: string, serieNumber: number) {
  const dataDir = getLocalDataDir();
  const seriesDir = path.join(dataDir, 'uploads', `series/${categoryCode}/${serieNumber}`);

  let extractedFiles = { images: 0, audio: 0, video: 0, responses: 0, txtProcessed: false as boolean };

  try {
    if (fs.existsSync(seriesDir)) {
      try { fs.rmSync(seriesDir, { recursive: true, force: true }); } catch {}
    }
    fs.mkdirSync(seriesDir, { recursive: true });

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

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

      // TXT
      if (entryName.endsWith('.txt')) {
        txtContent = fileData.toString('utf-8');
        continue;
      }

      const ext = path.extname(entryName).toLowerCase();
      const imgExts = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif', '.webp'];

      try {
        if (imgExts.includes(ext) && isQuestionImageEntry(entryName, entryNameFull)) {
          const qNum = extractQuestionNumber(baseNameOriginal);
          const dirPath = path.join(seriesDir, 'images');
          fs.mkdirSync(dirPath, { recursive: true });
          const targetName = qNum ? `q${qNum}${ext}` : baseNameOriginal;
          fs.writeFileSync(path.join(dirPath, targetName), fileData);
          extractedFiles.images++;
          continue;
        }

        if (imgExts.includes(ext) && isResponseImageEntry(entryName, entryNameFull)) {
          const rNum = extractResponseNumber(baseNameOriginal);
          const dirPath = path.join(seriesDir, 'responses');
          fs.mkdirSync(dirPath, { recursive: true });
          const targetName = rNum ? `r${rNum}${ext}` : baseNameOriginal;
          fs.writeFileSync(path.join(dirPath, targetName), fileData);
          extractedFiles.responses++;
          continue;
        }

        if (ext === '.mp3' && isAudioEntry(entryName, entryNameFull)) {
          const qNum = extractQuestionNumber(baseNameOriginal);
          const dirPath = path.join(seriesDir, 'audio');
          fs.mkdirSync(dirPath, { recursive: true });
          const saveName = qNum ? `q${qNum}.mp3` : baseNameOriginal;
          fs.writeFileSync(path.join(dirPath, saveName), fileData);
          extractedFiles.audio++;
          continue;
        }

        if (ext === '.mp4' && isVideoEntry(entryName, entryNameFull)) {
          const qNum = extractQuestionNumber(baseNameOriginal);
          const dirPath = path.join(seriesDir, 'video');
          fs.mkdirSync(dirPath, { recursive: true });
          const saveName = qNum ? `q${qNum}.mp4` : baseNameOriginal;
          fs.writeFileSync(path.join(dirPath, saveName), fileData);
          extractedFiles.video++;
          continue;
        }
      } catch {}
    }

    // Scan files on disk
    const imageFiles = scanDir(path.join(seriesDir, 'images'), ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'], extractQuestionNumber);
    const audioFiles = scanDir(path.join(seriesDir, 'audio'), ['.mp3', '.wav', '.ogg'], extractQuestionNumber);
    const responseFiles = scanDir(path.join(seriesDir, 'responses'), ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'], extractResponseNumber);
    const videoFiles = scanDir(path.join(seriesDir, 'video'), ['.mp4', '.webm', '.avi'], extractQuestionNumber);

    // Process TXT and save questions
    let questionsImported = 0;
    if (txtContent) {
      questionsImported = await processTxtAndSaveQuestions(txtContent, categoryCode, serieNumber, {
        imageFiles, audioFiles, responseFiles, videoFiles,
      });
    }

    // Mark TXT as processed if we found and used it
    extractedFiles.txtProcessed = !!txtContent && questionsImported > 0;

    // Encrypt all media files to prevent copying
    const encResult = encryptDirectory(seriesDir);
    if (encResult.encrypted > 0) {
      console.log(`[Repair+Import] Encrypted ${encResult.encrypted} files in ${categoryCode}/${serieNumber}`);
    }

    return {
      extracted: extractedFiles,
      questionsImported,
      success: true,
      message: `✅ ${questionsImported} question(s) importée(s) avec succès pour ${categoryCode}/${serieNumber}`,
    };
  } catch (error) {
    console.error('Import repaired ZIP error:', error);
    throw error;
  }
}

// =====================================================================
// LEGACY: Full Repair + Import in one shot (desktop mode)
// =====================================================================
async function repairAndImportLocal(zipBuffer: Buffer, categoryCode: string, serieNumber: number) {
  // Step 1: prepare
  const prepareResult = await repairAndPrepare(zipBuffer, categoryCode);
  // Step 2: import
  const repairedBuffer = Buffer.from(prepareResult.repairedZipBase64, 'base64');
  const importResult = await importRepairedZip(repairedBuffer, categoryCode, serieNumber);

  return {
    report: prepareResult.report,
    compression: prepareResult.compression,
    extracted: importResult.extracted,
    questionsImported: importResult.questionsImported,
  };
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
// CLOUD MODE: Legacy repair ZIP buffer and return new ZIP
// =====================================================================
async function repairZipBuffer(zipBuffer: Buffer): Promise<{ report: { repaired: string[]; removed: string[]; skipped: string[] }; repairedBuffer: Buffer }> {
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
