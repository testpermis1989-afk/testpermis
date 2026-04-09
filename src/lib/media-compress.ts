/**
 * Media Compression Utility
 * Compresses MP3 audio and MP4 video files using FFmpeg
 * For Electron desktop app - uses native FFmpeg binary
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

let ffmpegPath: string | null = null;
let ffmpegChecked = false;
let ffmpegAvailable: boolean | null = null;

/**
 * Get FFmpeg binary path
 * Tries: @ffmpeg-installer/ffmpeg → system PATH → common Windows paths
 * Uses purely dynamic require to avoid Turbopack build analysis
 */
export function getFfmpegPath(): string | null {
  if (ffmpegChecked) return ffmpegPath;
  ffmpegChecked = true;

  // Method 1: Find ffmpeg binary by scanning node_modules directly
  // This avoids any require() that Turbopack could trace
  try {
    const nodeModulesDir = findNodeModules();
    if (nodeModulesDir) {
      const platform = process.platform === 'win32' ? 'win32-x64'
        : process.platform === 'darwin' ? 'darwin-x64'
        : 'linux-x64';
      const arch = process.arch === 'arm64' ? `${process.platform}-arm64` : undefined;
      const candidates = [
        path.join(nodeModulesDir, '@ffmpeg-installer', platform, 'ffmpeg'),
        arch ? path.join(nodeModulesDir, '@ffmpeg-installer', arch, 'ffmpeg') : null,
        path.join(nodeModulesDir, '@ffmpeg-installer', 'ffmpeg', 'ffmpeg'),
      ].filter(Boolean) as string[];

      // Add .exe suffix for Windows
      for (const c of candidates) {
        const exePath = process.platform === 'win32' ? c + '.exe' : c;
        if (fs.existsSync(exePath)) {
          ffmpegPath = exePath;
          ffmpegAvailable = true;
          console.log('[MediaCompress] Found bundled FFmpeg:', ffmpegPath);
          return ffmpegPath;
        }
      }
    }
  } catch (e) {
    console.log('[MediaCompress] @ffmpeg-installer/ffmpeg scan failed');
  }

  return null;
}

/**
 * Find node_modules directory by walking up from __dirname
 */
function findNodeModules(): string | null {
  // In standalone mode, node_modules is next to the server
  const candidates = [
    /*turbopackIgnore: true*/ process.cwd(),
    path.dirname(/*turbopackIgnore: true*/ process.argv[1] || ''),
    __dirname,
  ];

  for (const startDir of candidates) {
    let dir = startDir;
    for (let i = 0; i < 5; i++) {
      const nm = path.join(dir, 'node_modules');
      if (fs.existsSync(nm)) return nm;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

/**
 * Check if FFmpeg is available (async - can check system PATH)
 */
export async function isFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;

  // Check bundled first
  if (getFfmpegPath()) return true;

  // Try system ffmpeg
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    ffmpegPath = 'ffmpeg';
    ffmpegAvailable = true;
    console.log('[MediaCompress] Using system FFmpeg');
    return true;
  } catch {
    // Try common Windows paths
    const winPaths = [
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      path.join(process.env.ProgramFiles || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    ];
    for (const p of winPaths) {
      try {
        fs.accessSync(p);
        ffmpegPath = p;
        ffmpegAvailable = true;
        console.log('[MediaCompress] Found FFmpeg at:', p);
        return true;
      } catch {}
    }

    ffmpegAvailable = false;
    console.warn('[MediaCompress] FFmpeg not available - audio/video will not be compressed');
    return false;
  }
}

/**
 * Compress MP3 file
 * Re-encodes to lower bitrate (default: 64kbps mono for voice)
 *
 * @param inputBuffer - Original MP3 file data
 * @param options - Compression options
 * @returns Compressed buffer, or null if FFmpeg unavailable or compression failed
 */
export async function compressMp3(
  inputBuffer: Buffer,
  options?: { bitrate?: string; channels?: number }
): Promise<Buffer | null> {
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg) return null;

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `mc_input_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`);
  const outputPath = path.join(tmpDir, `mc_output_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`);

  try {
    fs.writeFileSync(inputPath, inputBuffer);

    const bitrate = options?.bitrate || '64k';
    const channels = options?.channels || 1; // mono for voice questions

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

    return null; // compression didn't help, return null (caller will use original)
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
 * Re-encodes to 480p H.264 with lower bitrate
 *
 * @param inputBuffer - Original MP4 file data
 * @param options - Compression options
 * @returns Compressed buffer, or null if FFmpeg unavailable or compression failed
 */
export async function compressMp4(
  inputBuffer: Buffer,
  options?: { width?: number; height?: number; videoBitrate?: string; audioBitrate?: string }
): Promise<Buffer | null> {
  const ffmpeg = await resolveFfmpeg();
  if (!ffmpeg) return null;

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `mc_input_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`);
  const outputPath = path.join(tmpDir, `mc_output_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`);

  try {
    fs.writeFileSync(inputPath, inputBuffer);

    const width = options?.width || 854;
    const height = options?.height || 480;
    const videoBitrate = options?.videoBitrate || '500k';
    const audioBitrate = options?.audioBitrate || '64k';

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

    return null; // compression didn't help
  } catch (err) {
    console.warn('[MediaCompress] MP4 compression failed:', (err as Error).message);
    return null;
  } finally {
    safeUnlink(inputPath);
    safeUnlink(outputPath);
  }
}

/**
 * Resolve FFmpeg path (async wrapper)
 */
async function resolveFfmpeg(): Promise<string | null> {
  if (ffmpegPath) return ffmpegPath;
  if (await isFfmpegAvailable()) return ffmpegPath;
  return null;
}

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
