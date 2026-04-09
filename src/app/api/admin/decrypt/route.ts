import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { decryptDirectory, isEncryptionEnabled, clearDecryptCache } from '@/lib/file-encryption';

/**
 * POST /api/admin/decrypt - Decrypt all .enc files in a series directory
 * Restores original files and removes .enc versions
 * 
 * Query params:
 *   category - Category code (A, B, C, D, E)
 *   serie - Serie number
 * 
 * Body (optional):
 *   action: "decrypt" | "status"
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('category');
    const serieNumber = searchParams.get('serie');

    if (!categoryCode || !serieNumber) {
      return NextResponse.json({ error: 'Missing category or serie' }, { status: 400 });
    }

    const dataDir = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
    const seriesDir = path.join(dataDir, 'uploads', `series/${categoryCode}/${serieNumber}`);

    if (!fs.existsSync(seriesDir)) {
      return NextResponse.json({ error: 'Serie directory not found', path: seriesDir }, { status: 404 });
    }

    // Count .enc files before decryption
    let encCountBefore = 0;
    function countEncFiles(dir: string) {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) countEncFiles(fullPath);
          else if (entry.toLowerCase().endsWith('.enc')) encCountBefore++;
        }
      } catch {}
    }
    countEncFiles(seriesDir);

    // Decrypt all .enc files
    const result = decryptDirectory(seriesDir);
    
    // Clear cache after decryption
    clearDecryptCache();

    return NextResponse.json({
      success: true,
      category: categoryCode,
      serie: serieNumber,
      encFilesBefore: encCountBefore,
      decrypted: result.decrypted,
      failed: result.failed,
      encryptionEnabled: isEncryptionEnabled(),
      message: result.decrypted > 0 
        ? `${result.decrypted} fichiers décryptés avec succès` 
        : result.failed > 0 
          ? `${result.failed} fichiers n'ont pas pu être décryptés (clé différente?)` 
          : 'Aucun fichier .enc trouvé dans cette série',
    });
  } catch (error) {
    console.error('[Decrypt] Error:', error);
    return NextResponse.json({ error: 'Decryption failed: ' + (error as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/admin/decrypt - Check encryption status for a series
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryCode = searchParams.get('category');
    const serieNumber = searchParams.get('serie');

    if (!categoryCode || !serieNumber) {
      return NextResponse.json({ 
        encryptionEnabled: isEncryptionEnabled(),
        error: 'Provide category and serie to check specific series' 
      }, { status: 400 });
    }

    const dataDir = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
    const seriesDir = path.join(dataDir, 'uploads', `series/${categoryCode}/${serieNumber}`);

    const status = {
      encryptionEnabled: isEncryptionEnabled(),
      seriePath: seriesDir,
      exists: fs.existsSync(seriesDir),
      encFiles: 0,
      totalFiles: 0,
      subDirs: {} as Record<string, { encFiles: number; plainFiles: number }>,
    };

    if (status.exists) {
      function scanDir(dir: string, relativePath: string) {
        try {
          const entries = fs.readdirSync(dir);
          let encFiles = 0;
          let plainFiles = 0;

          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              scanDir(fullPath, `${relativePath}/${entry}`);
            } else if (stat.isFile()) {
              status.totalFiles++;
              if (entry.toLowerCase().endsWith('.enc')) {
                status.encFiles++;
                encFiles++;
              } else {
                plainFiles++;
              }
            }
          }

          if (relativePath && (encFiles > 0 || plainFiles > 0)) {
            status.subDirs[relativePath] = { encFiles, plainFiles };
          }
        } catch {}
      }
      scanDir(seriesDir, '');
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('[Decrypt] Status check error:', error);
    return NextResponse.json({ error: 'Status check failed: ' + (error as Error).message }, { status: 500 });
  }
}
