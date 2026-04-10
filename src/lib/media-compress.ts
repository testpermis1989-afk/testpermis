/**
 * Media Compression Utility
 * Compresses MP3 audio and MP4 video files
 * 
 * Strategy (auto-fallback, NO system dependencies required):
 *   1. System FFmpeg (fastest, native performance - if installed)
 *   2. ffmpeg-static (bundled binary - ALWAYS works, ~76MB)
 * 
 * MP3: Re-encodes to 64kbps mono (optimized for voice/questions audio)
 * MP4: Re-encodes to 480p H.264 with lower bitrate (optimized for short clips)
 */
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ===== Resolve FFmpeg binary =====
let _resolvedFfmpeg: string | null = null;
let _ffmpegChecked = false;

/**
 * Resolve the best available FFmpeg binary.
 * Priority: bundled Electron -> system PATH -> ffmpeg-static (npm)
 * Always succeeds because ffmpeg-static is a bundled fallback.
 */
export async function isFfmpegAvailable(): Promise<boolean> {
  return !!(await resolveFfmpeg());
}

export function getFfmpegPath(): string | null {
  if (_resolvedFfmpeg) return _resolvedFfmpeg;
  return null;
}

/**
 * Get the absolute path to the FFmpeg binary (guaranteed to work)
 * Tries: bundled with Electron -> system PATH -> common Windows paths -> ffmpeg-static (npm package)
 */
async function resolveFfmpeg(): Promise<string | null> {
  if (_ffmpegChecked) return _resolvedFfmpeg;
  _ffmpegChecked = true;

  // 1. Try bundled with Electron app
  try {
    const candidates = [
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'ffmpeg'),
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'resources', 'ffmpeg'),
      path.join(/*turbopackIgnore: true*/ process.resourcesPath || '', 'ffmpeg'),
    ];
    for (const dir of candidates) {
      const exePath = process.platform === 'win32' ? dir + '.exe' : dir;
      if (fs.existsSync(exePath)) {
        _resolvedFfmpeg = exePath;
        console.log('[MediaCompress] Using bundled FFmpeg:', _resolvedFfmpeg);
        return _resolvedFfmpeg;
      }
    }
  } catch {}

  // 2. Try system FFmpeg (PATH)
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    _resolvedFfmpeg = 'ffmpeg';
    console.log('[MediaCompress] Using system FFmpeg');
    return _resolvedFfmpeg;
  } catch {}

  // 3. Try common Windows paths
  try {
    const winPaths = [
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      path.join(process.env.ProgramFiles || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) {
        _resolvedFfmpeg = p;
        console.log('[MediaCompress] Found FFmpeg at:', _resolvedFfmpeg);
        return _resolvedFfmpeg;
      }
    }
  } catch {}

  // 4. Use ffmpeg-static (bundled with npm - ALWAYS available, no system deps)
  try {
    const staticPath = require('ffmpeg-static') as string;
    if (staticPath && fs.existsSync(staticPath)) {
      _resolvedFfmpeg = staticPath;
      console.log('[MediaCompress] Using ffmpeg-static (bundled, no system deps):', _resolvedFfmpeg);
      return _resolvedFfmpeg;
    }
  } catch {}

  console.error('[MediaCompress] ERROR: No FFmpeg binary found (not even ffmpeg-static)');
  return null;
}

// ===== Main compression functions =====

/**
 * Compress MP3 file
 * Re-encodes to 64kbps mono 22050Hz (optimized for voice/questions)
 *
 * @param inputBuffer - Original MP3 file data
 * @param options - Compression options
 * @returns Compressed buffer, or null if compression unavailable or didn't reduce size
 */
export async function compressMp3(
  inputBuffer: Buffer,
  options?: { bitrate?: string; channels?: number }
): Promise<Buffer | null> {
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg) return null;

  const bitrate = options?.bitrate || '64k';
  const channels = options?.channels || 1; // mono for voice questions

  const tmpDir = os.tmpdir();
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(tmpDir, `mc_in_${uid}.mp3`);
  const outputPath = path.join(tmpDir, `mc_out_${uid}.mp3`);

  try {
    fs.writeFileSync(inputPath, inputBuffer);

    await execFileAsync(ffmpeg, [
      '-i', inputPath,
      '-b:a', bitrate,
      '-ac', String(channels),
      '-ar', '22050', // 22050 Hz is sufficient for voice
      '-y',
      outputPath,
    ], { timeout: 60000 });

    const outputBuffer = fs.readFileSync(outputPath);

    // Only return compressed if it's actually smaller
    if (outputBuffer.length > 0 && outputBuffer.length < inputBuffer.length) {
      return outputBuffer;
    }

    return null;
  } catch (err) {
    console.warn('[MediaCompress] MP3 compression failed:', (err as Error).message);
    return null;
  } finally {
    safeUnlink(inputPath);
    safeUnlink(outputPath);
  }
}

/**
 * Compress MP4 video file
 * Re-encodes to 480p H.264, CRF 28, 500kbps video, 64kbps audio
 *
 * @param inputBuffer - Original MP4 file data
 * @param options - Compression options
 * @returns Compressed buffer, or null if compression unavailable or didn't reduce size
 */
export async function compressMp4(
  inputBuffer: Buffer,
  options?: { width?: number; height?: number; videoBitrate?: string; audioBitrate?: string }
): Promise<Buffer | null> {
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg) return null;

  const width = options?.width || 854;
  const height = options?.height || 480;
  const videoBitrate = options?.videoBitrate || '500k';
  const audioBitrate = options?.audioBitrate || '64k';

  const tmpDir = os.tmpdir();
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(tmpDir, `mc_in_${uid}.mp4`);
  const outputPath = path.join(tmpDir, `mc_out_${uid}.mp4`);

  try {
    fs.writeFileSync(inputPath, inputBuffer);

    await execFileAsync(ffmpeg, [
      '-i', inputPath,
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264',
      '-b:v', videoBitrate,
      '-preset', 'fast',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', audioBitrate,
      '-ac', '1',
      '-ar', '22050',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ], { timeout: 120000 });

    const outputBuffer = fs.readFileSync(outputPath);

    // Only return compressed if it's actually smaller
    if (outputBuffer.length > 0 && outputBuffer.length < inputBuffer.length) {
      return outputBuffer;
    }

    return null;
  } catch (err) {
    console.warn('[MediaCompress] MP4 compression failed:', (err as Error).message);
    return null;
  } finally {
    safeUnlink(inputPath);
    safeUnlink(outputPath);
  }
}

// ===== Utilities =====

/**
 * Safely delete a file (ignore errors)
 */
function safeUnlink(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

/**
 * Format bytes to human-readable size
 */
export function formatMediaSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
