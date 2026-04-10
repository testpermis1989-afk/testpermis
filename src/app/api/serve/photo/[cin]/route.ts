import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { decryptFileCached, isEncryptionEnabled } from '@/lib/file-encryption';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

// Extensions to try when searching for the photo
const PHOTO_EXTENSIONS = ['.jpg', '.png', '.jpeg', '.gif', '.webp', '.bmp'];

// GET /api/serve/photo/[cin] - Serve user photo (decrypt if encrypted)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cin: string }> }
) {
  try {
    const { cin } = await params;

    // Validate CIN (prevent directory traversal)
    if (!cin || cin.includes('..') || cin.includes('/') || cin.includes('\\')) {
      return NextResponse.json({ error: 'Invalid CIN' }, { status: 400 });
    }

    const dataDir = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
    const photosDir = path.join(dataDir, 'photos');

    if (!fs.existsSync(photosDir)) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Try to find the photo (encrypted .enc first, then plain)
    let photoFound = false;

    // 1. Try encrypted version: {cin}.jpg.enc, {cin}.png.enc, etc.
    if (isEncryptionEnabled()) {
      for (const ext of PHOTO_EXTENSIONS) {
        const encPath = path.join(photosDir, `${cin}${ext}.enc`);
        if (fs.existsSync(encPath)) {
          const result = decryptFileCached(encPath);
          if (result) {
            const originalExt = result.ext.toLowerCase();
            const contentType = MIME_TYPES[originalExt] || 'image/jpeg';
            return new NextResponse(result.data, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Length': result.data.length.toString(),
                'Cache-Control': 'private, max-age=3600',
              },
            });
          }
        }
      }
    }

    // 2. Try plain (unencrypted) version
    for (const ext of PHOTO_EXTENSIONS) {
      const filePath = path.join(photosDir, `${cin}${ext}`);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const contentType = MIME_TYPES[ext] || 'image/jpeg';
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
    }

    // 3. Fuzzy: search directory for any file starting with the CIN
    try {
      const files = fs.readdirSync(photosDir);
      for (const f of files) {
        const baseName = path.basename(f, path.extname(f));
        // Remove .enc if present
        const cleanBase = baseName.endsWith('.enc') ? baseName.slice(0, -4) : baseName;
        if (cleanBase.toUpperCase() === cin.toUpperCase()) {
          const filePath = path.join(photosDir, f);

          if (f.endsWith('.enc')) {
            const result = decryptFileCached(filePath);
            if (result) {
              const originalExt = result.ext.toLowerCase();
              const contentType = MIME_TYPES[originalExt] || 'image/jpeg';
              return new NextResponse(result.data, {
                status: 200,
                headers: {
                  'Content-Type': contentType,
                  'Content-Length': result.data.length.toString(),
                  'Cache-Control': 'private, max-age=3600',
                },
              });
            }
          } else {
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(f).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'image/jpeg';
            return new NextResponse(buffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'private, max-age=3600',
              },
            });
          }
        }
      }
    } catch {}

    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  } catch (error) {
    console.error('Error serving photo:', error);
    return NextResponse.json({ error: 'Failed to serve photo' }, { status: 500 });
  }
}
