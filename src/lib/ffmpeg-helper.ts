// FFmpeg WebAssembly helper
// 100% JavaScript, works in Electron without any native binaries
// Used for audio (MP3) and video (MP4) repair

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;
let ffmpegLoaded = false;
let ffmpegError: string | null = null;

/**
 * Get or create the FFmpeg WASM instance (lazy loaded, singleton)
 */
export async function getFFmpeg(): Promise<FFmpeg | null> {
  // Already loaded successfully
  if (ffmpegLoaded && ffmpegInstance) return ffmpegInstance;

  // Currently loading - wait
  if (ffmpegLoading) {
    // Wait up to 30 seconds for loading
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (ffmpegLoaded && ffmpegInstance) return ffmpegInstance;
    }
    return null;
  }

  // Failed before - don't retry
  if (ffmpegError) {
    console.warn('[FFmpeg] Previously failed, not retrying:', ffmpegError);
    return null;
  }

  // Start loading
  ffmpegLoading = true;
  try {
    console.log('[FFmpeg] Loading WebAssembly FFmpeg...');
    const ffmpeg = new FFmpeg();

    // Log progress
    ffmpeg.on('log', ({ message }) => {
      // Only log important messages
      if (message.includes('error') || message.includes('Error')) {
        console.warn('[FFmpeg]', message);
      }
    });

    // Load FFmpeg with CDN URLs for core files
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: `${baseURL}/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg-core.wasm`,
    });

    ffmpegInstance = ffmpeg;
    ffmpegLoaded = true;
    ffmpegLoading = false;
    console.log('[FFmpeg] Loaded successfully!');
    return ffmpeg;
  } catch (err) {
    ffmpegError = (err as Error).message;
    ffmpegLoading = false;
    console.error('[FFmpeg] Failed to load:', ffmpegError);
    return null;
  }
}

/**
 * Repair a corrupted MP3 file using FFmpeg
 * Re-encodes the audio to fix headers and corruption
 */
export async function repairMp3(inputBuffer: Buffer): Promise<{ data: Buffer; repaired: boolean; error?: string }> {
  const ffmpeg = await getFFmpeg();
  if (!ffmpeg) {
    return { data: inputBuffer, repaired: false, error: 'FFmpeg WASM non disponible' };
  }

  try {
    // Write input file
    await ffmpeg.writeFile('input.mp3', inputBuffer);

    // Try to repair by re-encoding
    // -ss 0: start from beginning
    // -i input.mp3: input file
    // -acodec libmp3lame: re-encode as MP3
    // -ar 44100: standard sample rate
    // -ac 2: stereo
    // -b:a 128k: bitrate
    await ffmpeg.exec([
      '-y',                    // Overwrite output
      '-i', 'input.mp3',       // Input
      '-acodec', 'libmp3lame', // MP3 codec
      '-ar', '44100',          // Sample rate
      '-ac', '2',              // Stereo
      '-b:a', '128k',          // Bitrate
      'output.mp3',            // Output
    ]);

    // Read output
    const outputData = await ffmpeg.readFile('output.mp3');
    const outputBuffer = Buffer.from(outputData);

    // Cleanup
    try { await ffmpeg.deleteFile('input.mp3'); } catch {}
    try { await ffmpeg.deleteFile('output.mp3'); } catch {}

    if (outputBuffer.length > 0) {
      console.log(`[FFmpeg] MP3 repaired: ${inputBuffer.length} → ${outputBuffer.length} bytes`);
      return { data: outputBuffer, repaired: true };
    }

    return { data: inputBuffer, repaired: false, error: 'Output vide après réparation' };
  } catch (err) {
    console.warn('[FFmpeg] MP3 repair failed:', (err as Error).message);
    try { await ffmpeg.deleteFile('input.mp3'); } catch {}
    try { await ffmpeg.deleteFile('output.mp3'); } catch {}
    return { data: inputBuffer, repaired: false, error: (err as Error).message };
  }
}

/**
 * Repair a corrupted MP4 file using FFmpeg
 * Re-muxes or re-encodes the video to fix container issues
 */
export async function repairMp4(inputBuffer: Buffer): Promise<{ data: Buffer; repaired: boolean; error?: string }> {
  const ffmpeg = await getFFmpeg();
  if (!ffmpeg) {
    return { data: inputBuffer, repaired: false, error: 'FFmpeg WASM non disponible' };
  }

  try {
    // Write input file
    await ffmpeg.writeFile('input.mp4', inputBuffer);

    // Strategy 1: Try to re-mux (copy streams, fix container)
    // This is fast and preserves original quality
    try {
      await ffmpeg.exec([
        '-y',
        '-i', 'input.mp4',
        '-c', 'copy',         // Copy streams without re-encoding
        '-movflags', '+faststart', // Move moov atom to start
        'output.mp4',
      ]);

      const outputData = await ffmpeg.readFile('output.mp4');
      const outputBuffer = Buffer.from(outputData);

      if (outputBuffer.length > 1000) { // Valid MP4 should be > 1KB
        try { await ffmpeg.deleteFile('input.mp4'); } catch {}
        try { await ffmpeg.deleteFile('output.mp4'); } catch {}
        console.log(`[FFmpeg] MP4 repaired (remux): ${inputBuffer.length} → ${outputBuffer.length} bytes`);
        return { data: outputBuffer, repaired: true };
      }
    } catch {
      console.log('[FFmpeg] Remux failed, trying re-encode...');
    }

    // Strategy 2: Re-encode if re-mux failed (slower but more thorough)
    try {
      await ffmpeg.exec([
        '-y',
        '-i', 'input.mp4',
        '-vcodec', 'libx264',   // Re-encode video
        '-acodec', 'aac',       // Re-encode audio
        '-preset', 'fast',
        '-crf', '23',           // Quality
        '-movflags', '+faststart',
        'output.mp4',
      ]);

      const outputData = await ffmpeg.readFile('output.mp4');
      const outputBuffer = Buffer.from(outputData);

      try { await ffmpeg.deleteFile('input.mp4'); } catch {}
      try { await ffmpeg.deleteFile('output.mp4'); } catch {}

      if (outputBuffer.length > 1000) {
        console.log(`[FFmpeg] MP4 repaired (re-encode): ${inputBuffer.length} → ${outputBuffer.length} bytes`);
        return { data: outputBuffer, repaired: true };
      }

      return { data: inputBuffer, repaired: false, error: 'Output trop petit après ré-encodage' };
    } catch (encodeErr) {
      console.warn('[FFmpeg] MP4 re-encode failed:', (encodeErr as Error).message);
    }

    try { await ffmpeg.deleteFile('input.mp4'); } catch {}
    try { await ffmpeg.deleteFile('output.mp4'); } catch {}
    return { data: inputBuffer, repaired: false, error: 'Toutes les tentatives de réparation ont échoué' };
  } catch (err) {
    console.warn('[FFmpeg] MP4 repair failed:', (err as Error).message);
    try { await ffmpeg.deleteFile('input.mp4'); } catch {}
    try { await ffmpeg.deleteFile('output.mp4'); } catch {}
    return { data: inputBuffer, repaired: false, error: (err as Error).message };
  }
}

/**
 * Check if FFmpeg is available
 */
export function isFFmpegLoaded(): boolean {
  return ffmpegLoaded;
}
