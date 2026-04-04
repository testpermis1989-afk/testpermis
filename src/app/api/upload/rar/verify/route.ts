import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import AdmZip from 'adm-zip';

// POST /api/upload/rar/verify - Re-vérify un ZIP temporaire (après réparation)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const importId = body.importId;

    if (!importId) {
      return NextResponse.json({ error: 'Missing importId' }, { status: 400 });
    }

    // The uploadJobs map is shared via the parent module (upload/rar/route.ts)
    // Since we can't directly import the in-memory map from another route module,
    // we need to find the job from the in-memory store.
    // For verification only (after repair), the repaired ZIP buffer should be passed
    // or we need to find it in the shared state.
    
    // This route now expects a base64-encoded ZIP buffer in the request body
    const zipBufferBase64 = body.zipBuffer;
    if (!zipBufferBase64) {
      return NextResponse.json({ error: 'Missing zipBuffer (base64)' }, { status: 400 });
    }

    const zipBuffer = Buffer.from(zipBufferBase64, 'base64');
    const verification = verifyZipBuffer(zipBuffer);
    return NextResponse.json({ success: true, verification });
  } catch (error) {
    console.error('Re-verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

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

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

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
    } catch { continue; }

    if (entryName.endsWith('.txt') && !txtFound) {
      try {
        txtContent = fileData.toString('utf-8');
        txtFound = true;
        result.txtFile.found = true;
      } catch {}
      continue;
    }

    if (isQuestionImage(entryName, entryNameFull)) {
      const num = extractNumber(baseNameOriginal);
      if (num) {
        const isValid = isValidImageFile(fileData);
        questionImages.set(num, { name: baseNameOriginal, valid: isValid });
        result.images.files.push(baseNameOriginal);
        if (!isValid) result.images.corrupted.push(baseNameOriginal);
      }
      continue;
    }

    if (isResponseImage(entryName, entryNameFull)) {
      const num = extractResponseNumber(baseNameOriginal);
      if (num) {
        const isValid = isValidImageFile(fileData);
        responseImages.set(num, { name: baseNameOriginal, valid: isValid });
        result.responses.files.push(baseNameOriginal);
        if (!isValid) result.responses.corrupted.push(baseNameOriginal);
      }
      continue;
    }

    if (isAudioFile(entryName, entryNameFull)) {
      const num = extractNumber(baseNameOriginal);
      if (num) {
        const isValid = isValidMp3File(fileData);
        questionAudio.set(num, { name: baseNameOriginal, valid: isValid });
        result.audio.files.push(baseNameOriginal);
        if (!isValid) result.audio.corrupted.push(baseNameOriginal);
      }
      continue;
    }

    if (isVideoFile(entryName, entryNameFull)) {
      const num = extractNumber(baseNameOriginal);
      if (num) {
        const isValid = isValidMp4File(fileData);
        questionVideo.set(num, { name: baseNameOriginal, valid: isValid });
        result.video.files.push(baseNameOriginal);
        if (!isValid) result.video.corrupted.push(baseNameOriginal);
      }
      continue;
    }
  }

  if (!txtFound) {
    result.errors.push('Aucun fichier TXT trouvé');
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

function isValidImageFile(data: Buffer): boolean {
  if (data.length < 8) return false;
  const h = data.slice(0, 16);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return true;
  if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return true;
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38) return true;
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return true;
  if (h[0] === 0x42 && h[1] === 0x4D) return true;
  return false;
}

function isValidMp3File(data: Buffer): boolean {
  if (data.length < 10) return false;
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true;
  if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true;
  return false;
}

function isValidMp4File(data: Buffer): boolean {
  if (data.length < 12) return false;
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true;
  if (data[4] === 0x6D && data[5] === 0x6F && data[6] === 0x6F && data[7] === 0x76) return true;
  if (data[4] === 0x6D && data[5] === 0x64 && data[6] === 0x61 && data[7] === 0x74) return true;
  return false;
}

function extractNumber(filename: string): number | null {
  const match = filename.match(/(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function extractResponseNumber(filename: string): number | null {
  const match = filename.match(/r(\d+)/i);
  return match ? parseInt(match[1]) : extractNumber(filename);
}

function isQuestionImage(entryName: string, entryNameOriginal: string): boolean {
  const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
  if (!exts.some(ext => entryName.endsWith(ext))) return false;
  if (entryName.includes('images/') || entryName.includes('question')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  return /^q\d+/i.test(base) || /^\d+\./.test(base);
}

function isResponseImage(entryName: string, entryNameOriginal: string): boolean {
  const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg'];
  if (!exts.some(ext => entryName.endsWith(ext))) return false;
  if (entryName.includes('responses/') || entryName.includes('reponses/') || entryName.includes('answers/')) return true;
  return /^r\d+/i.test(path.basename(entryNameOriginal).toLowerCase());
}

function isAudioFile(entryName: string, entryNameOriginal: string): boolean {
  if (!entryName.endsWith('.mp3')) return false;
  if (entryName.includes('audio/')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  return /^q\d+/i.test(base) || /^\d+\.mp3$/i.test(base);
}

function isVideoFile(entryName: string, entryNameOriginal: string): boolean {
  if (!entryName.endsWith('.mp4')) return false;
  if (entryName.includes('video/')) return true;
  const base = path.basename(entryNameOriginal).toLowerCase();
  return /^q\d+/i.test(base) || /^\d+\.mp4$/i.test(base);
}
