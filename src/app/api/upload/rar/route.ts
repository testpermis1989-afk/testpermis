import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { db } from '@/lib/db';

// POST /api/upload/rar - Upload, verify and extract ZIP file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const categoryCode = formData.get('category') as string;
    const serieNumber = formData.get('serie') as string;
    const verifyOnly = formData.get('verifyOnly') === 'true'; // New parameter for verification only

    if (!file || !categoryCode || !serieNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.zip')) {
      return NextResponse.json({ error: 'Seuls les fichiers ZIP sont acceptés' }, { status: 400 });
    }

    // Create target directories
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber);
    
    // Save the uploaded file temporarily
    const tempPath = path.join(uploadDir, `temp_${file.name}`);
    
    // Create upload directory
    await mkdir(uploadDir, { recursive: true });
    
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempPath, buffer);

    // First, verify the ZIP file and analyze contents
    let verification;
    try {
      verification = await verifyZipFile(tempPath);
    } catch (error) {
      // Clean up on error
      if (existsSync(tempPath)) await unlink(tempPath);
      const errorMsg = (error as Error).message || 'Erreur inconnue';
      return NextResponse.json({ 
        success: false,
        error: 'Erreur lors de la vérification du fichier ZIP',
        details: errorMsg,
        verification: {
          isValid: false,
          errors: [`Erreur lors de la lecture du ZIP: ${errorMsg}`, 'Le fichier est peut-être corrompu ou non valide'],
          warnings: [],
          txtFile: { found: false, questions: 0 },
          images: { count: 0, files: [], missing: [], corrupted: [] },
          audio: { count: 0, files: [], missing: [], corrupted: [] },
          video: { count: 0, files: [], corrupted: [] },
          responses: { count: 0, files: [], missing: [], corrupted: [] },
          questionsDetails: []
        }
      }, { status: 400 });
    }

    // If verifyOnly mode, always return verification results (even with errors)
    if (verifyOnly) {
      if (existsSync(tempPath)) await unlink(tempPath);
      return NextResponse.json({
        success: true,
        mode: 'verification',
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        verification
      });
    }

    // Check if verification passed before importing
    if (!verification.isValid) {
      if (existsSync(tempPath)) await unlink(tempPath);
      return NextResponse.json({ 
        success: false,
        error: 'La vérification a échoué',
        verification 
      }, { status: 400 });
    }

    // Proceed with extraction and import
    const imagesDir = path.join(uploadDir, 'images');
    const audioDir = path.join(uploadDir, 'audio');
    const videoDir = path.join(uploadDir, 'video');
    const responsesDir = path.join(uploadDir, 'responses');

    await mkdir(imagesDir, { recursive: true });
    await mkdir(audioDir, { recursive: true });
    await mkdir(videoDir, { recursive: true });
    await mkdir(responsesDir, { recursive: true });

    let extractedFiles = {
      images: 0,
      audio: 0,
      video: 0,
      responses: 0,
      txtFile: false as string | false
    };

    let questionsImported = 0;

    try {
      // Extract ZIP file
      const zip = new AdmZip(tempPath);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        const entryName = entry.entryName.toLowerCase();
        const entryNameOriginal = entry.entryName;
        const baseNameOriginal = path.basename(entry.entryName);

        // Detect TXT file
        if (entryName.endsWith('.txt') && (
          entryName.includes('reponse') || 
          entryName.includes('response') || 
          entryName.includes('answer') ||
          entryName.includes('question') ||
          entryName === 'data.txt' ||
          entryName.match(/^[^\/]+\.txt$/)
        )) {
          const txtPath = path.join(uploadDir, baseNameOriginal);
          zip.extractEntryTo(entry, uploadDir, false, true);
          extractedFiles.txtFile = txtPath;
          continue;
        }

        // Question images
        if (isQuestionImage(entryName, entryNameOriginal)) {
          zip.extractEntryTo(entry, imagesDir, false, true);
          extractedFiles.images++;
          continue;
        }

        // Response images
        if (isResponseImage(entryName, entryNameOriginal)) {
          zip.extractEntryTo(entry, responsesDir, false, true);
          extractedFiles.responses++;
          continue;
        }

        // Audio files - MP3 only
        if (isAudioFile(entryName, entryNameOriginal)) {
          zip.extractEntryTo(entry, audioDir, false, true);
          extractedFiles.audio++;
          continue;
        }

        // Video files - MP4 only
        if (isVideoFile(entryName, entryNameOriginal)) {
          zip.extractEntryTo(entry, videoDir, false, true);
          extractedFiles.video++;
          continue;
        }
      }

      // Process TXT file if found
      if (extractedFiles.txtFile && typeof extractedFiles.txtFile === 'string') {
        questionsImported = await processTxtFile(extractedFiles.txtFile, categoryCode, parseInt(serieNumber));
        await unlink(extractedFiles.txtFile);
      }

    } finally {
      if (existsSync(tempPath)) {
        await unlink(tempPath);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fichier traité avec succès!`,
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      extracted: {
        images: extractedFiles.images,
        audio: extractedFiles.audio,
        video: extractedFiles.video,
        responses: extractedFiles.responses,
        txtProcessed: extractedFiles.txtFile !== false
      },
      questionsImported,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + (error as Error).message }, { status: 500 });
  }
}

// Verify ZIP file and analyze contents
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
  
  // Try to open and read the ZIP file
  try {
    zip = new AdmZip(zipPath);
    entries = zip.getEntries();
  } catch (zipError) {
    result.isValid = false;
    const errorMsg = (zipError as Error).message || 'Erreur inconnue';
    result.errors.push(`Impossible d'ouvrir le fichier ZIP: ${errorMsg}`);
    result.errors.push('Vérifiez que le fichier est un ZIP valide et non corrompu');
    return result;
  }

  // Check if ZIP is valid
  if (!entries || entries.length === 0) {
    result.errors.push('Le fichier ZIP est vide ou ne contient aucun fichier');
    result.isValid = false;
    return result;
  }

  // Collect all files by type with validation
  const questionImages = new Map<number, { name: string; valid: boolean }>();
  const questionAudio = new Map<number, { name: string; valid: boolean }>();
  const questionVideo = new Map<number, { name: string; valid: boolean }>();
  const responseImages = new Map<number, { name: string; valid: boolean }>();
  let txtContent = '';
  let txtFound = false;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName.toLowerCase();
    const entryNameOriginal = entry.entryName;
    const baseNameOriginal = path.basename(entry.entryName);
    
    // Try to read file data with error handling
    let fileData: Buffer;
    try {
      fileData = entry.getData();
    } catch (readError) {
      result.warnings.push(`Impossible de lire le fichier: ${baseNameOriginal} (${(readError as Error).message || 'erreur inconnue'})`);
      continue;
    }

    // Detect TXT file
    if (entryName.endsWith('.txt') && !txtFound) {
      try {
        txtContent = fileData.toString('utf-8');
        txtFound = true;
        result.txtFile.found = true;
      } catch (txtError) {
        result.errors.push(`Erreur lors de la lecture du fichier TXT (${baseNameOriginal}): ${(txtError as Error).message || 'encodage invalide'}`);
      }
      continue;
    }

    // Question images - validate
    if (isQuestionImage(entryName, entryNameOriginal)) {
      const num = extractQuestionNumber(baseNameOriginal);
      if (num) {
        const isValid = validateImageFile(fileData, baseNameOriginal);
        questionImages.set(num, { name: baseNameOriginal, valid: isValid });
        result.images.files.push(baseNameOriginal);
        if (!isValid) {
          result.images.corrupted.push(baseNameOriginal);
        }
      }
      continue;
    }

    // Response images - validate
    if (isResponseImage(entryName, entryNameOriginal)) {
      const num = extractResponseNumber(baseNameOriginal);
      if (num) {
        const isValid = validateImageFile(fileData, baseNameOriginal);
        responseImages.set(num, { name: baseNameOriginal, valid: isValid });
        result.responses.files.push(baseNameOriginal);
        if (!isValid) {
          result.responses.corrupted.push(baseNameOriginal);
        }
      }
      continue;
    }

    // Audio files - validate MP3
    if (isAudioFile(entryName, entryNameOriginal)) {
      const num = extractQuestionNumber(baseNameOriginal);
      if (num) {
        const isValid = validateMp3File(fileData, baseNameOriginal);
        questionAudio.set(num, { name: baseNameOriginal, valid: isValid });
        result.audio.files.push(baseNameOriginal);
        if (!isValid) {
          result.audio.corrupted.push(baseNameOriginal);
        }
      }
      continue;
    }

    // Video files - validate MP4
    if (isVideoFile(entryName, entryNameOriginal)) {
      const num = extractQuestionNumber(baseNameOriginal);
      if (num) {
        const isValid = validateMp4File(fileData, baseNameOriginal);
        questionVideo.set(num, { name: baseNameOriginal, valid: isValid });
        result.video.files.push(baseNameOriginal);
        if (!isValid) {
          result.video.corrupted.push(baseNameOriginal);
        }
      }
      continue;
    }
  }

  // Parse TXT content
  if (!txtFound) {
    result.errors.push('Aucun fichier TXT trouvé dans le ZIP');
    result.errors.push('Le fichier doit s\'appeler "reponses.txt" ou contenir "reponse" dans le nom');
    result.isValid = false;
    return result;
  }

  // Show first few lines of TXT for debugging
  const txtLines = txtContent.split('\n');
  const previewLines = txtLines.slice(0, 5).map(l => l.trim()).filter(l => l);
  if (previewLines.length > 0) {
    result.warnings.push(`Aperçu du fichier TXT: "${previewLines[0].substring(0, 50)}..."`);
  }

  const lines = txtContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const questionNumbers: number[] = [];
  const questionAnswers = new Map<number, string>();
  const parseErrors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(/[\t\s,;]+/).filter(p => p);
    if (parts.length >= 2) {
      const qNum = parseInt(parts[0]);
      const answers = parts[1];
      if (!isNaN(qNum)) {
        questionNumbers.push(qNum);
        questionAnswers.set(qNum, answers);
      } else {
        parseErrors.push(`Ligne ${i + 1}: "${line.substring(0, 30)}" - numéro de question invalide`);
      }
    } else if (parts.length === 1) {
      parseErrors.push(`Ligne ${i + 1}: "${line.substring(0, 30)}" - format incorrect (manque la réponse)`);
    }
  }

  // Show parsing errors as warnings
  if (parseErrors.length > 0) {
    result.warnings.push(`Erreurs de parsing: ${parseErrors.slice(0, 3).join('; ')}${parseErrors.length > 3 ? `... (+${parseErrors.length - 3} autres)` : ''}`);
  }

  result.txtFile.questions = questionNumbers.length;

  if (questionNumbers.length === 0) {
    result.errors.push('Aucune question trouvée dans le fichier TXT');
    result.errors.push('Format attendu: "1<TAB>3" ou "1 3" (numéro + réponse)');
    result.isValid = false;
    return result;
  }

  // Verify each question has required files
  for (const qNum of questionNumbers.sort((a, b) => a - b)) {
    const imageData = questionImages.get(qNum);
    const audioData = questionAudio.get(qNum);
    const videoData = questionVideo.get(qNum);
    const responseData = responseImages.get(qNum);
    
    const hasImage = !!imageData;
    const hasAudio = !!audioData;
    const hasVideo = !!videoData;
    const hasResponse = !!responseData;
    const answers = questionAnswers.get(qNum) || '';

    result.questionsDetails.push({
      num: qNum,
      hasImage,
      hasAudio,
      hasVideo,
      hasResponse,
      answers,
      imageValid: imageData?.valid ?? false,
      audioValid: audioData?.valid ?? false,
      videoValid: videoData?.valid ?? false,
      responseValid: responseData?.valid ?? false
    });

    // Check if question has either image OR video
    if (!hasImage && !hasVideo) {
      result.images.missing.push(qNum);
    }

    // Check if question has audio
    if (!hasAudio) {
      result.audio.missing.push(qNum);
    }

    // Check if question has response image
    if (!hasResponse) {
      result.responses.missing.push(qNum);
    }
  }

  // Set counts
  result.images.count = questionImages.size;
  result.audio.count = questionAudio.size;
  result.video.count = questionVideo.size;
  result.responses.count = responseImages.size;

  // Add warnings for missing files
  if (result.images.missing.length > 0) {
    result.warnings.push(`Questions sans image ni vidéo: ${result.images.missing.join(', ')}`);
  }
  if (result.audio.missing.length > 0) {
    result.warnings.push(`Questions sans audio: ${result.audio.missing.join(', ')}`);
  }
  if (result.responses.missing.length > 0) {
    result.warnings.push(`Questions sans image de réponse: ${result.responses.missing.join(', ')}`);
  }

  // Add warnings for corrupted files
  if (result.images.corrupted.length > 0) {
    result.errors.push(`Images corrompues: ${result.images.corrupted.join(', ')}`);
  }
  if (result.audio.corrupted.length > 0) {
    result.errors.push(`Fichiers audio corrompus: ${result.audio.corrupted.join(', ')}`);
  }
  if (result.video.corrupted.length > 0) {
    result.errors.push(`Fichiers vidéo corrompus: ${result.video.corrupted.join(', ')}`);
  }
  if (result.responses.corrupted.length > 0) {
    result.errors.push(`Images de réponse corrompues: ${result.responses.corrupted.join(', ')}`);
  }

  // Check for extra files (not matching any question)
  const extraImages = [...questionImages.keys()].filter(n => !questionNumbers.includes(n));
  const extraAudio = [...questionAudio.keys()].filter(n => !questionNumbers.includes(n));
  const extraVideo = [...questionVideo.keys()].filter(n => !questionNumbers.includes(n));
  const extraResponses = [...responseImages.keys()].filter(n => !questionNumbers.includes(n));

  if (extraImages.length > 0) {
    result.warnings.push(`Images sans question correspondante: ${extraImages.join(', ')}`);
  }
  if (extraAudio.length > 0) {
    result.warnings.push(`Audio sans question correspondante: ${extraAudio.join(', ')}`);
  }
  if (extraVideo.length > 0) {
    result.warnings.push(`Vidéo sans question correspondante: ${extraVideo.join(', ')}`);
  }
  if (extraResponses.length > 0) {
    result.warnings.push(`Réponses sans question correspondante: ${extraResponses.join(', ')}`);
  }

  // Determine if valid (must have at least image OR video for each question)
  // We'll allow import even with warnings, but show them to user
  result.isValid = result.errors.length === 0;

  return result;
}

// Validate image file by checking magic bytes
function validateImageFile(data: Buffer, filename: string): boolean {
  if (data.length < 8) return false;
  
  const header = data.slice(0, 16);
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return true;
  }
  
  // JPEG: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    // Check for JPEG end marker (FF D9) somewhere in the file
    const endMarker = data.slice(-2);
    if (endMarker[0] === 0xFF && endMarker[1] === 0xD9) {
      return true;
    }
    // Some JPEGs might not have end marker, but still valid
    return true;
  }
  
  // GIF: 47 49 46 38 (GIF8)
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) {
    return true;
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
    // Check for WEBP marker at offset 8
    if (data.length > 12 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
      return true;
    }
  }
  
  // BMP: 42 4D
  if (header[0] === 0x42 && header[1] === 0x4D) {
    return true;
  }
  
  // If file extension matches but header doesn't, it might be corrupted
  console.log(`Invalid image header for ${filename}`);
  return false;
}

// Validate MP3 file by checking magic bytes
function validateMp3File(data: Buffer, filename: string): boolean {
  if (data.length < 10) return false;
  
  // MP3 can start with:
  // ID3 tag: 49 44 33 (ID3)
  // MP3 frame sync: FF FB or FF FA or FF F3 or FF F2
  
  const header = data.slice(0, 10);
  
  // ID3 tag
  if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
    return true;
  }
  
  // MP3 frame sync (various bit rates)
  if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
    return true;
  }
  
  console.log(`Invalid MP3 header for ${filename}`);
  return false;
}

// Validate MP4 file by checking magic bytes
function validateMp4File(data: Buffer, filename: string): boolean {
  if (data.length < 12) return false;
  
  // MP4/MOV typically starts with:
  // ftyp box: starts with size, then 'ftyp'
  // Common: 00 00 00 XX 66 74 79 70 (....ftyp)
  
  // Check for ftyp at offset 4
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) {
    return true;
  }
  
  // Check for moov atom (some MP4s start with this)
  if (data[4] === 0x6D && data[5] === 0x6F && data[6] === 0x6F && data[7] === 0x76) {
    return true;
  }
  
  // Check for mdat atom
  if (data[4] === 0x6D && data[5] === 0x64 && data[6] === 0x61 && data[7] === 0x74) {
    return true;
  }
  
  console.log(`Invalid MP4 header for ${filename}`);
  return false;
}

// Extract question number from filename
function extractQuestionNumber(filename: string): number | null {
  const match = filename.match(/(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

// Extract response number from filename
function extractResponseNumber(filename: string): number | null {
  const match = filename.match(/r(\d+)/i);
  return match ? parseInt(match[1]) : extractQuestionNumber(filename);
}

// Helper functions to detect file types
function isQuestionImage(entryName: string, entryNameOriginal: string): boolean {
  // All image extensions
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
  const hasImageExt = imageExtensions.some(ext => entryName.endsWith(ext));
  if (!hasImageExt) return false;

  // In images folder
  if (entryName.includes('images/') || entryName.includes('image/') || 
      entryName.includes('questions/') || entryName.includes('question/')) return true;

  // Named like q1, q2, Q1, Q2, 1.png, 2.png, etc.
  const baseName = path.basename(entryNameOriginal).toLowerCase();
  if (/^q\d+/i.test(baseName) || /^\d+\./.test(baseName)) return true;

  return false;
}

function isResponseImage(entryName: string, entryNameOriginal: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
  const hasImageExt = imageExtensions.some(ext => entryName.endsWith(ext));
  if (!hasImageExt) return false;

  // In responses or r folder
  if (entryName.includes('responses/') || entryName.includes('response/') || 
      entryName.includes('reponses/') || entryName.includes('reponse/') ||
      entryName.includes('r/') || entryName.includes('answers/')) return true;

  // Named like r1, r2, R1, R2
  const baseName = path.basename(entryNameOriginal).toLowerCase();
  if (/^r\d+/i.test(baseName)) return true;

  return false;
}

function isAudioFile(entryName: string, entryNameOriginal: string): boolean {
  // MP3 only
  if (!entryName.endsWith('.mp3')) return false;

  // In audio folder
  if (entryName.includes('audio/') || entryName.includes('son/') || entryName.includes('sound/')) return true;

  // Named like q1, q2, Q1, Q2, 1.mp3, 2.mp3
  const baseName = path.basename(entryNameOriginal).toLowerCase();
  if (/^q\d+/i.test(baseName) || /^\d+\.mp3$/i.test(baseName)) return true;

  return false;
}

function isVideoFile(entryName: string, entryNameOriginal: string): boolean {
  // MP4 only
  if (!entryName.endsWith('.mp4')) return false;

  // In video folder
  if (entryName.includes('video/') || entryName.includes('videos/')) return true;

  // Named like q1, q2, Q1, Q2, 1.mp4, 2.mp4
  const baseName = path.basename(entryNameOriginal).toLowerCase();
  if (/^q\d+/i.test(baseName) || /^\d+\.mp4$/i.test(baseName)) return true;

  return false;
}

async function processTxtFile(txtPath: string, categoryCode: string, serieNumber: number): Promise<number> {
  const { readFile } = await import('fs/promises');
  const content = await readFile(txtPath, 'utf-8');
  // Split by lines and filter empty lines and comments
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  // Get or create category
  let category = await db.category.findUnique({ where: { code: categoryCode } });
  if (!category) {
    category = await db.category.create({
      data: {
        code: categoryCode,
        name: getCategoryName(categoryCode),
        nameAr: getCategoryNameAr(categoryCode),
      },
    });
  }

  // Get or create serie
  let serie = await db.serie.findFirst({
    where: { categoryId: category.id, number: serieNumber },
  });
  if (!serie) {
    serie = await db.serie.create({
      data: {
        categoryId: category.id,
        number: serieNumber,
      },
    });
  }

  // Clear existing questions in this serie
  await db.response.deleteMany({ where: { question: { serieId: serie.id } } });
  await db.question.deleteMany({ where: { serieId: serie.id } });

  // Import questions
  let imported = 0;
  
  for (const line of lines) {
    // Parse format: "1\t3" or "1 3" or "1,3" (question_number separator answers)
    // Split by tab, space, comma, or semicolon
    const parts = line.split(/[\t\s,;]+/).filter(p => p);
    
    if (parts.length < 2) continue;
    
    const questionNumber = parseInt(parts[0]);
    const correctAnswers = parts[1];
    
    if (isNaN(questionNumber)) continue;

    // Get actual image extension from files
    const imagesDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber.toString(), 'images');
    const responsesDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber.toString(), 'responses');
    const audioDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber.toString(), 'audio');
    const videoDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber.toString(), 'video');

    const imageExt = await findFileExtension(imagesDir, `q${questionNumber}`);
    const responseExt = await findFileExtension(responsesDir, `r${questionNumber}`);
    const audioExt = await findFileExtension(audioDir, `q${questionNumber}`);
    const videoExt = await findFileExtension(videoDir, `q${questionNumber}`);

    // Create question with paths to media
    const question = await db.question.create({
      data: {
        serieId: serie.id,
        order: questionNumber,
        image: imageExt ? `/uploads/${categoryCode}/${serieNumber}/images/q${questionNumber}.${imageExt}` : '',
        audio: audioExt ? `/uploads/${categoryCode}/${serieNumber}/audio/q${questionNumber}.${audioExt}` : '',
        video: videoExt ? `/uploads/${categoryCode}/${serieNumber}/video/q${questionNumber}.${videoExt}` : null,
        text: responseExt ? `/uploads/${categoryCode}/${serieNumber}/responses/r${questionNumber}.${responseExt}` : '',
      },
    });

    // Create 4 responses
    for (let j = 1; j <= 4; j++) {
      const isCorrect = correctAnswers.includes(String(j));
      await db.response.create({
        data: {
          questionId: question.id,
          order: j,
          text: `Réponse ${j}`,
          isCorrect,
        },
      });
    }

    imported++;
  }

  // Update serie questions count
  await db.serie.update({
    where: { id: serie.id },
    data: { questionsCount: imported },
  });

  return imported;
}

// Find file extension for a given base name
async function findFileExtension(dir: string, baseName: string): Promise<string | null> {
  if (!existsSync(dir)) return null;
  
  try {
    const files = await readdir(dir);
    for (const file of files) {
      const fileLower = file.toLowerCase();
      if (fileLower.startsWith(baseName.toLowerCase() + '.') || 
          fileLower === baseName.toLowerCase() + '.png' ||
          fileLower === baseName.toLowerCase() + '.jpg' ||
          fileLower === baseName.toLowerCase() + '.jpeg' ||
          fileLower === baseName.toLowerCase() + '.gif' ||
          fileLower === baseName.toLowerCase() + '.webp' ||
          fileLower === baseName.toLowerCase() + '.mp3' ||
          fileLower === baseName.toLowerCase() + '.mp4') {
        const ext = file.split('.').pop();
        return ext || null;
      }
    }
  } catch {
    // Directory read error
  }
  return null;
}

function getCategoryName(code: string): string {
  const names: Record<string, string> = {
    A: 'Moto',
    B: 'Voiture',
    C: 'Camion',
    D: 'Bus',
    E: 'Remorque',
  };
  return names[code] || code;
}

function getCategoryNameAr(code: string): string {
  const names: Record<string, string> = {
    A: 'دراجة نارية',
    B: 'سيارة',
    C: 'شاحنة',
    D: 'حافلة',
    E: 'مقطورة',
  };
  return names[code] || code;
}

// GET - List uploaded files
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryCode = searchParams.get('category');
  const serieNumber = searchParams.get('serie');

  if (!categoryCode || !serieNumber) {
    return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', categoryCode, serieNumber);
  
  const result = {
    path: `/uploads/${categoryCode}/${serieNumber}/`,
    images: [] as string[],
    audio: [] as string[],
    video: [] as string[],
    responses: [] as string[],
    exists: existsSync(uploadDir)
  };

  if (result.exists) {
    try {
      const imagesDir = path.join(uploadDir, 'images');
      const audioDir = path.join(uploadDir, 'audio');
      const videoDir = path.join(uploadDir, 'video');
      const responsesDir = path.join(uploadDir, 'responses');

      if (existsSync(imagesDir)) {
        const files = await readdir(imagesDir);
        result.images = files.filter(f => /\.(png|jpg|jpeg|gif|webp|bmp|tiff|svg)$/i.test(f));
      }
      if (existsSync(audioDir)) {
        const files = await readdir(audioDir);
        result.audio = files.filter(f => /\.mp3$/i.test(f));
      }
      if (existsSync(videoDir)) {
        const files = await readdir(videoDir);
        result.video = files.filter(f => /\.mp4$/i.test(f));
      }
      if (existsSync(responsesDir)) {
        const files = await readdir(responsesDir);
        result.responses = files.filter(f => /\.(png|jpg|jpeg|gif|webp|bmp|tiff|svg)$/i.test(f));
      }
    } catch {
      // Directory read error
    }
  }

  return NextResponse.json(result);
}
