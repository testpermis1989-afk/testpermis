import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { decryptFileCached, isEncryptedFile } from '@/lib/file-encryption';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
};

// Extensions to try when a file is not found (ordered by likelihood)
const FALLBACK_EXTENSIONS = ['.enc', '.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.mp3', '.mp4', '.webm', '.svg'];

function serveFile(filePath: string): NextResponse | null {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;

    const ext = path.extname(filePath).toLowerCase();

    // Handle encrypted files (.enc)
    if (ext === '.enc') {
      const result = decryptFileCached(filePath);
      if (!result) {
        // Decryption failed - file may be encrypted on a different machine
        // Try to serve the underlying file without .enc extension
        const originalPath = filePath.slice(0, -4); // remove .enc
        if (fs.existsSync(originalPath)) {
          console.warn(`[Serve] Decrypt failed for ${filePath}, trying original: ${originalPath}`);
          return serveFile(originalPath);
        }
        console.warn(`[Serve] Failed to decrypt and no original found: ${filePath}`);
        return null;
      }
      const buffer = result.data;
      const originalExt = result.ext.toLowerCase();
      const contentType = MIME_TYPES[originalExt] || 'application/octet-stream';
      const isMedia = ['.mp3', '.mp4', '.webm', '.wav', '.ogg', '.aac'].includes(originalExt);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': isMedia ? 'no-cache' : 'public, max-age=31536000, immutable',
          ...(contentType.startsWith('video/') || contentType.startsWith('audio/') ? {
            'Accept-Ranges': 'bytes',
          } : {}),
        },
      });
    }

    // Serve unencrypted file
    const buffer = fs.readFileSync(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isMedia = ['.mp3', '.mp4', '.webm', '.wav', '.ogg', '.aac'].includes(ext);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': isMedia ? 'no-cache' : 'public, max-age=31536000, immutable',
        ...(contentType.startsWith('video/') || contentType.startsWith('audio/') ? {
          'Accept-Ranges': 'bytes',
        } : {}),
      },
    });
  } catch {
    return null;
  }
}

// Extract a number from a filename pattern like 'q1', 'r1', 'question1', 'image_1'
function extractNumberFromBasename(baseName: string): number | null {
  const match = baseName.match(/\d+/);
  return match ? parseInt(match[1]) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = pathSegments.join('/');

    // Prevent directory traversal attacks
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
    const fullPath = path.join(DATA_DIR, 'uploads', filePath);

    // 1. Check exact file exists
    if (fs.existsSync(fullPath)) {
      const response = serveFile(fullPath);
      if (response) return response;
    }

    // 1b. Check if encrypted version exists (q1.png -> q1.png.enc)
    // encryptFile() creates filePath + '.enc', NOT baseName + '.enc'
    const encFullPath = fullPath + '.enc';
    if (fs.existsSync(encFullPath)) {
      const response = serveFile(encFullPath);
      if (response) return response;
    }

    // 2. Try alternative extensions (same basename, different ext)
    // .enc is first priority since all encrypted files use this extension
    const dir = path.dirname(fullPath);
    const baseName = path.basename(fullPath, path.extname(fullPath));

    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      for (const altExt of FALLBACK_EXTENSIONS) {
        const altPath = path.join(dir, baseName + altExt);
        if (fs.existsSync(altPath)) {
          const response = serveFile(altPath);
          if (response) return response;
        }
      }

      // 3. FUZZY FALLBACK: Search directory for any file matching the question number
      const num = extractNumberFromBasename(baseName);
      if (num !== null) {
        const isResponse = /^r\d+$/i.test(baseName);
        const prefix = isResponse ? 'r' : 'q';

        try {
          const dirFiles = fs.readdirSync(dir);
          for (const f of dirFiles) {
            const fLower = f.toLowerCase();
            // Get the base name without .enc if it's encrypted
            let fBaseName = f;
            if (f.endsWith('.enc')) {
              fBaseName = f.slice(0, -4);
            }
            const fNum = extractNumberFromBasename(path.basename(fBaseName, path.extname(fBaseName)));

            if (fNum === num) {
              const fExt = path.extname(fBaseName).toLowerCase();
              const startsWithPrefix = fLower.startsWith(prefix.toLowerCase());
              if (startsWithPrefix || (FALLBACK_EXTENSIONS as readonly string[]).includes(fExt) || f.endsWith('.enc')) {
                const matchPath = path.join(dir, f);
                if (fs.existsSync(matchPath)) {
                  const response = serveFile(matchPath);
                  if (response) {
                    console.log(`[Serve] Fuzzy match: '${filePath}' -> '${f}' (same number ${num})`);
                    return response;
                  }
                }
              }
            }
          }
        } catch (scanErr) {
          console.warn('[Serve] Fuzzy search error:', scanErr);
        }
      }
    }

    console.warn(`[Serve] File not found: ${filePath} (tried extensions + fuzzy search)`);
    return NextResponse.json({ error: 'File not found', path: filePath }, { status: 404 });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
