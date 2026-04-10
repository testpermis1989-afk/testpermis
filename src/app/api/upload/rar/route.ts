import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { saveSerieQuestions } from '@/lib/series-file';
import { encryptDirectory, isEncryptionEnabled, clearDecryptCache } from '@/lib/file-encryption';

// Lazy load database
async function getDb() {
  const { db } = await import('@/lib/db');
  return db;
}

function getDataDir(): string {
  return process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
}

function getCategoryName(code: string): string {
  const names: Record<string, string> = {
    A: 'Moto', B: 'Voiture', C: 'Camion', D: 'Bus', E: 'Remorque',
  };
  return names[code] || code;
}

function getCategoryNameAr(code: string): string {
  const names: Record<string, string> = {
    A: 'دراجة نارية', B: 'سيارة', C: 'شاحنة', D: 'حافلة', E: 'مقطورة',
  };
  return names[code] || code;
}

// Parse answer file (reponses.txt, answers.txt, etc.)
function parseAnswerFile(content: string): Map<number, string> {
  const answers = new Map<number, string>();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    // Format: "question_number correct_answer" or just "correct_answer" (line number = question number)
    const parts = trimmed.split(/[\s,;\t]+/);
    if (parts.length >= 2) {
      const num = parseInt(parts[0]);
      const ans = parts[1].trim();
      if (!isNaN(num) && ans) {
        answers.set(num, ans);
      }
    } else if (parts.length === 1) {
      const ans = parts[0].trim();
      if (ans && /^\d+$/.test(ans)) {
        // Line number is implicit question number
        answers.set(answers.size + 1, ans);
      }
    }
  }
  return answers;
}

// Count files by type in extracted directory
function countExtractedFiles(dir: string): { images: number; audio: number; video: number; responses: number } {
  const result = { images: 0, audio: 0, video: 0, responses: 0 };
  if (!fs.existsSync(dir)) return result;

  function scan(d: string) {
    const entries = fs.readdirSync(d);
    for (const entry of entries) {
      const fullPath = path.join(d, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scan(fullPath);
      } else {
        const lower = entry.toLowerCase();
        if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(lower)) {
          if (d.toLowerCase().includes('response') || d.toLowerCase().includes('reponse') || /^r\d+/i.test(entry)) {
            result.responses++;
          } else {
            result.images++;
          }
        } else if (/\.(mp3|wav|ogg|aac)$/i.test(lower)) {
          result.audio++;
        } else if (/\.(mp4|webm|avi|mov)$/i.test(lower)) {
          result.video++;
        }
      }
    }
  }
  scan(dir);
  return result;
}

// Extract ZIP and organize files into the target directory
function extractZipToTarget(zipBuffer: Buffer, targetDir: string): {
  extracted: { images: number; audio: number; video: number; responses: number };
  txtProcessed: boolean;
  questionsCount: number;
  answers: Map<number, string>;
  warnings: string[];
} {
  const warnings: string[] = [];
  let txtProcessed = false;
  let questionsCount = 0;
  const answers = new Map<number, string>();

  // Create target subdirectories
  const imagesDir = path.join(targetDir, 'images');
  const audioDir = path.join(targetDir, 'audio');
  const videoDir = path.join(targetDir, 'video');
  const responsesDir = path.join(targetDir, 'responses');

  for (const dir of [imagesDir, audioDir, videoDir, responsesDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Open and extract ZIP
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName;
    const lowerName = entryName.toLowerCase();

    // Skip hidden files, macOS metadata, thumbs.db
    if (entryName.includes('__MACOSX') || entryName.includes('.DS_Store') || lowerName === 'thumbs.db') continue;

    // Check for answer file
    if (/^(reponses?|answers?|corrige)\.(txt|csv)$/i.test(path.basename(entryName))) {
      try {
        const content = entry.getData().toString('utf-8');
        const parsed = parseAnswerFile(content);
        for (const [k, v] of parsed) {
          answers.set(k, v);
        }
        txtProcessed = true;
        questionsCount = answers.size;
      } catch (e) {
        warnings.push(`Impossible de lire le fichier réponses: ${entryName}`);
      }
      continue;
    }

    // Determine file extension and target subdirectory
    let ext = path.extname(entryName).toLowerCase();
    let targetSubDir: string | null = null;

    // Image files
    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(ext)) {
      // Check if it's a response file (r1.png, reponse1.png, etc.)
      const baseName = path.basename(entryName, ext).toLowerCase();
      if (/^r\d+$/.test(baseName) || /^reponse\d+$/.test(baseName) || /^response\d+$/.test(baseName)) {
        targetSubDir = responsesDir;
      } else {
        targetSubDir = imagesDir;
      }
    }
    // Audio files
    else if (/\.(mp3|wav|ogg|aac)$/i.test(ext)) {
      targetSubDir = audioDir;
    }
    // Video files
    else if (/\.(mp4|webm|avi|mov)$/i.test(ext)) {
      targetSubDir = videoDir;
    }

    if (targetSubDir) {
      // Normalize filename: lowercase, keep only alphanumeric, dash, underscore, dot
      let fileName = path.basename(entryName);
      fileName = fileName.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
      const targetPath = path.join(targetSubDir, fileName);

      try {
        const fileData = entry.getData();
        fs.writeFileSync(targetPath, fileData);
      } catch (e) {
        warnings.push(`Impossible d'extraire: ${entryName}`);
      }
    }
  }

  const extracted = countExtractedFiles(targetDir);
  return { extracted, txtProcessed, questionsCount, answers, warnings };
}

// Save questions to both JSON file and database
async function saveQuestions(
  categoryCode: string,
  serieNumber: number,
  answers: Map<number, string>
): Promise<number> {
  if (answers.size === 0) return 0;

  const questions: {
    order: number;
    imageUrl: string;
    audioUrl: string;
    videoUrl?: string | null;
    responseImageUrl?: string;
    correctAnswers: string;
  }[] = [];

  for (const [qNum, correctAns] of answers) {
    questions.push({
      order: qNum,
      imageUrl: `/api/serve/series/${categoryCode}/${serieNumber}/images/q${qNum}.png`,
      audioUrl: `/api/serve/series/${categoryCode}/${serieNumber}/audio/q${qNum}.mp3`,
      videoUrl: fs.existsSync(path.join(getDataDir(), 'uploads', 'series', categoryCode, String(serieNumber), 'video', `q${qNum}.mp4`))
        ? `/api/serve/series/${categoryCode}/${serieNumber}/video/q${qNum}.mp4`
        : null,
      responseImageUrl: `/api/serve/series/${categoryCode}/${serieNumber}/responses/r${qNum}.png`,
      correctAnswers,
    });
  }

  // Sort by question order
  questions.sort((a, b) => a.order - b.order);

  // PRIMARY: Save to JSON file
  const jsonResult = saveSerieQuestions(categoryCode, serieNumber, questions);
  console.log(`[Upload] Saved ${jsonResult.questionsImported} questions to JSON file`);

  // SECONDARY: Also try database
  try {
    const db = await getDb();
    let category = await db.category.findUnique({ where: { code: categoryCode } });
    if (!category) {
      category = await db.category.create({
        data: { code: categoryCode, name: getCategoryName(categoryCode), nameAr: getCategoryNameAr(categoryCode) },
      });
    }

    let serie = await db.serie.findFirst({ where: { categoryId: category.id, number: serieNumber } });
    if (!serie) {
      serie = await db.serie.create({ data: { categoryId: category.id, number: serieNumber } });
    }

    // Clear existing
    const existing = await db.question.findMany({ where: { serieId: serie.id } });
    if (existing.length > 0) {
      for (const q of existing) {
        try { await db.response.deleteMany({ where: { questionId: q.id } }); } catch {}
      }
      await db.question.deleteMany({ where: { serieId: serie.id } });
    }

    let imported = 0;
    for (const q of questions) {
      try {
        const question = await db.question.create({
          data: {
            serieId: serie.id,
            order: q.order,
            image: q.imageUrl,
            audio: q.audioUrl,
            text: q.responseImageUrl || '',
          },
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
    console.log('[Upload] DB save failed (JSON is primary):', dbErr);
  }

  return jsonResult.questionsImported;
}

// POST /api/upload/rar - Import series from ZIP file
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let zipBuffer: Buffer;
    let categoryCode: string;
    let serieNumber: number;
    let verifyOnly = false;

    if (contentType.includes('multipart/form-data')) {
      // Desktop mode: FormData with file
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      categoryCode = (formData.get('category') as string || '').toUpperCase();
      serieNumber = parseInt(formData.get('serie') as string || '0');
      verifyOnly = formData.get('verifyOnly') === 'true';

      if (!file) {
        return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
      }
      if (!categoryCode || !serieNumber) {
        return NextResponse.json({ error: 'Catégorie et numéro de série requis' }, { status: 400 });
      }

      zipBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      // Cloud mode: JSON with importId
      const body = await request.json();
      const { importId, category, serie } = body;
      categoryCode = (category || '').toUpperCase();
      serieNumber = parseInt(serie || '0');

      if (!importId || !categoryCode || !serieNumber) {
        return NextResponse.json({ error: 'importId, catégorie et numéro de série requis' }, { status: 400 });
      }

      // Download ZIP from temp storage
      const { getUploadBuffer } = await import('@/lib/upload-store');
      const buffer = await getUploadBuffer(importId);
      if (!buffer) {
        return NextResponse.json({ error: 'Fichier expiré ou introuvable. Veuillez ré-uploader.' }, { status: 400 });
      }
      zipBuffer = buffer;
    }

    // Validate ZIP
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      return NextResponse.json({
        error: 'Le fichier ZIP est corrompu ou invalide',
        verification: { isValid: false, errors: ['Le fichier ZIP ne peut pas être lu'], warnings: [], extracted: { images: 0, audio: 0, video: 0, responses: 0 } },
      });
    }

    const entries = zip.getEntries().filter(e => !e.isDirectory && !e.entryName.includes('__MACOSX'));

    // Verification
    const errors: string[] = [];
    const warnings: string[] = [];
    let hasAnswerFile = false;
    let imageCount = 0;
    let audioCount = 0;
    let videoCount = 0;
    let responseCount = 0;

    for (const entry of entries) {
      const lowerName = entry.entryName.toLowerCase();
      if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(lowerName)) {
        if (/^r\d+/i.test(path.basename(entry.entryName)) || lowerName.includes('response') || lowerName.includes('reponse')) {
          responseCount++;
        } else {
          imageCount++;
        }
      } else if (/\.(mp3|wav|ogg|aac)$/i.test(lowerName)) {
        audioCount++;
      } else if (/\.(mp4|webm|avi|mov)$/i.test(lowerName)) {
        videoCount++;
      } else if (/^(reponses?|answers?|corrige)\.(txt|csv)$/i.test(path.basename(entry.entryName))) {
        hasAnswerFile = true;
      }
    }

    if (imageCount === 0 && audioCount === 0 && videoCount === 0) {
      errors.push('Le ZIP ne contient aucun fichier média (images, audio, vidéo)');
    }
    if (!hasAnswerFile) {
      warnings.push('Aucun fichier réponses (.txt) trouvé - les questions ne seront pas enregistrées');
    }

    const isValid = errors.length === 0;

    // If verifyOnly, return verification result without importing
    if (verifyOnly) {
      return NextResponse.json({
        verification: {
          isValid,
          errors,
          warnings,
          extracted: { images: imageCount, audio: audioCount, video: videoCount, responses: responseCount },
          hasAnswerFile,
        },
      });
    }

    // If not valid and not verifyOnly, return error with verification info
    if (!isValid) {
      return NextResponse.json({
        error: errors.join('\n'),
        verification: { isValid, errors, warnings, extracted: { images: imageCount, audio: audioCount, video: videoCount, responses: responseCount } },
      });
    }

    // === ACTUAL IMPORT ===
    const dataDir = getDataDir();
    const targetDir = path.join(dataDir, 'uploads', 'series', categoryCode, String(serieNumber));

    // Clean existing files if re-importing
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    // Extract ZIP
    const result = extractZipToTarget(zipBuffer, targetDir);

    // Merge warnings
    for (const w of result.warnings) {
      if (!warnings.includes(w)) warnings.push(w);
    }

    // Save questions if we have answers
    let questionsImported = 0;
    if (result.answers.size > 0) {
      questionsImported = await saveQuestions(categoryCode, serieNumber, result.answers);
    }

    // Encrypt files after import
    let encryptionResult = { encrypted: 0, failed: 0 };
    if (isEncryptionEnabled()) {
      console.log('[Upload] Encrypting imported files...');
      encryptionResult = encryptDirectory(targetDir);
      clearDecryptCache();
      console.log(`[Upload] Encrypted ${encryptionResult.encrypted} files`);
    }

    return NextResponse.json({
      success: true,
      message: `Série ${categoryCode}-${serieNumber} importée avec succès!${encryptionResult.encrypted > 0 ? ` (${encryptionResult.encrypted} fichiers chiffrés)` : ''}`,
      extracted: result.extracted,
      txtProcessed: result.txtProcessed,
      questionsImported,
      encryption: encryptionResult,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    console.error('[Upload/RAR] Error:', error);
    return NextResponse.json({
      error: 'Erreur lors de l\'import: ' + (error instanceof Error ? error.message : String(error)),
    }, { status: 500 });
  }
}
