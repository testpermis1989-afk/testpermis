import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
const FALLBACK_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.mp3', '.mp4', '.webm', '.svg'];

function serveFile(filePath: string, contentType: string): NextResponse | null {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
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

    // Check file exists
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const response = serveFile(fullPath, contentType);
      if (response) return response;
    }

    // File not found - try alternative extensions
    const dir = path.dirname(fullPath);
    const baseName = path.basename(fullPath, path.extname(fullPath));

    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      for (const altExt of FALLBACK_EXTENSIONS) {
        const altPath = path.join(dir, baseName + altExt);
        if (fs.existsSync(altPath)) {
          const contentType = MIME_TYPES[altExt] || 'application/octet-stream';
          const response = serveFile(altPath, contentType);
          if (response) return response;
        }
      }
    }

    return NextResponse.json({ error: 'File not found', path: filePath }, { status: 404 });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
