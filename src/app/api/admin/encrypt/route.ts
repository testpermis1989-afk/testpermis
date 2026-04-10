import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { encryptDirectory, isEncryptionEnabled, clearDecryptCache } from '@/lib/file-encryption';

/**
 * POST /api/admin/encrypt - Encrypt all media files in a series directory
 * Files become .enc (AES-256-GCM) and can only be read by this app
 * 
 * Query params:
 *   category - Category code (A, B, C, D, E)
 *   serie - Serie number
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('category');
    const serieNumber = searchParams.get('serie');

    if (!categoryCode || !serieNumber) {
      return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
    }

    if (!isEncryptionEnabled()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Le chiffrement est désactivé (DISABLE_FILE_ENCRYPTION=true). Supprimez cette variable pour activer.' 
      }, { status: 400 });
    }

    const dataDir = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
    const seriesDir = path.join(dataDir, 'uploads', `series/${categoryCode}/${serieNumber}`);

    if (!fs.existsSync(seriesDir)) {
      return NextResponse.json({ error: 'Serie directory not found', path: seriesDir }, { status: 404 });
    }

    // Count plain (non-encrypted) files before
    let plainCountBefore = 0;
    function countPlainFiles(dir: string) {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) countPlainFiles(fullPath);
          else if (stat.isFile() && !entry.toLowerCase().endsWith('.enc') && !entry.toLowerCase().endsWith('.json')) {
            plainCountBefore++;
          }
        }
      } catch {}
    }
    countPlainFiles(seriesDir);

    // Encrypt all media files
    const result = encryptDirectory(seriesDir);
    
    // Clear cache
    clearDecryptCache();

    return NextResponse.json({
      success: true,
      category: categoryCode,
      serie: serieNumber,
      plainFilesBefore: plainCountBefore,
      encrypted: result.encrypted,
      failed: result.failed,
      message: result.encrypted > 0 
        ? `${result.encrypted} fichiers chiffrés ✓ (les fichiers sur disque sont illisibles hors de l'application)` 
        : plainCountBefore === 0
          ? 'Tous les fichiers sont déjà chiffrés ✓'
          : 'Aucun fichier média trouvé à chiffrer',
    });
  } catch (error) {
    console.error('[Encrypt] Error:', error);
    return NextResponse.json({ error: 'Encryption failed: ' + (error as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/admin/encrypt - Check encryption status for a series
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('category');
    const serieNumber = searchParams.get('serie');

    if (!categoryCode || !serieNumber) {
      return NextResponse.json({ 
        encryptionEnabled: isEncryptionEnabled(),
      });
    }

    const dataDir = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
    const seriesDir = path.join(dataDir, 'uploads', `series/${categoryCode}/${serieNumber}`);

    const status = {
      encryptionEnabled: isEncryptionEnabled(),
      seriePath: seriesDir,
      exists: fs.existsSync(seriesDir),
      plainFiles: 0,
      encFiles: 0,
      protected: false,
      subDirs: {} as Record<string, { plainFiles: number; encFiles: number }>,
    };

    if (status.exists) {
      function scanDir(dir: string, relativePath: string) {
        try {
          const entries = fs.readdirSync(dir);
          let plainFiles = 0;
          let encFiles = 0;

          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              scanDir(fullPath, `${relativePath}/${entry}`);
            } else if (stat.isFile() && !entry.toLowerCase().endsWith('.json')) {
              if (entry.toLowerCase().endsWith('.enc')) {
                status.encFiles++;
                encFiles++;
              } else {
                status.plainFiles++;
                plainFiles++;
              }
            }
          }

          if (relativePath && (encFiles > 0 || plainFiles > 0)) {
            status.subDirs[relativePath] = { plainFiles, encFiles };
          }
        } catch {}
      }
      scanDir(seriesDir, '');
      status.protected = status.plainFiles === 0 && status.encFiles > 0;
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('[Encrypt] Status check error:', error);
    return NextResponse.json({ error: 'Status check failed: ' + (error as Error).message }, { status: 500 });
  }
}
