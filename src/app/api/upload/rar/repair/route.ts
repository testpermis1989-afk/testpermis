import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import AdmZip from 'adm-zip';
import { getUploadBuffer, getUploadJob, saveUploadJob, hasUploadJob } from '@/lib/upload-store';

// Lazy load Jimp - 100% JavaScript, works in Electron without native binaries
let jimpModule: typeof import('jimp') | null = null;
function getJimp() {
  if (!jimpModule) {
    try { jimpModule = require('jimp'); } catch (e) {
      console.warn('[jimp] Module not available:', (e as Error).message);
    }
  }
  return jimpModule;
}

// POST /api/upload/rar/repair - Réparer les fichiers corrompus dans un ZIP
// Images: réparées avec Jimp (100% JavaScript)
// Audio/Vidéo: validation + report (pas de réparation possible sans FFmpeg natif)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const importId = body.importId;
    const zipBufferBase64 = body.zipBuffer;

    if (!importId && !zipBufferBase64) {
      return NextResponse.json({ error: 'Missing importId or zipBuffer' }, { status: 400 });
    }

    let zipBuffer: Buffer;

    if (zipBufferBase64) {
      // Direct buffer provided (backward compatibility)
      zipBuffer = Buffer.from(zipBufferBase64, 'base64');
    } else {
      // Load from Supabase temp storage
      const jobExists = await hasUploadJob(importId);
      if (!jobExists) {
        return NextResponse.json({ error: 'Fichier expiré, veuillez ré-uploader' }, { status: 400 });
      }
      const buffer = await getUploadBuffer(importId);
      if (!buffer) {
        return NextResponse.json({ error: 'Fichier introuvable' }, { status: 400 });
      }
      zipBuffer = buffer;
    }

    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      // Auto-detect parent folder
      const topLevelDirs = new Set<string>();
      for (const entry of entries) {
        const parts = entry.entryName.split('/').filter(Boolean);
        if (parts.length >= 2) topLevelDirs.add(parts[0].toLowerCase());
      }
      let stripParent = '';
      if (topLevelDirs.size === 1) stripParent = [...topLevelDirs][0] + '/';

      const report = {
        repaired: [] as string[],
        removed: [] as string[],
        skipped: [] as string[],
      };

      const newZip = new AdmZip();

      for (const entry of entries) {
        if (entry.isDirectory) {
          newZip.addFile(entry.entryName, Buffer.alloc(0));
          continue;
        }

        let entryName = entry.entryName;
        if (stripParent && entryName.startsWith(stripParent)) {
          entryName = entryName.substring(stripParent.length);
        }

        const ext = path.extname(entryName).toLowerCase();
        const baseName = path.basename(entryName);
        const dirName = entryName.substring(0, entryName.length - baseName.length);
        let fileData = entry.getData();

        // ===== REPAIR IMAGES (Jimp - 100% JavaScript, no native binaries needed!) =====
        if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif'].includes(ext)) {
          if (isValidImage(fileData)) {
            // Image valide - garder tel quel
            newZip.addFile(entry.entryName, fileData);
            continue;
          }

          // Try to repair with Jimp
          const Jimp = getJimp();
          if (!Jimp) {
            report.removed.push(`${baseName} — Image corrompue (Jimp non disponible)`);
            continue;
          }
          try {
            const image = await Jimp.read(fileData);
            image.scaleToFit(1024, 1024);
            const outputBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

            if (outputBuffer.length > 0) {
              const newBaseName = baseName.replace(/\.[^.]+$/, '.jpg');
              newZip.addFile(stripParent + dirName + newBaseName, outputBuffer);
              report.repaired.push(`${baseName} → Image réparée ✓`);
            } else {
              report.removed.push(`${baseName} — Image irréparable`);
            }
          } catch {
            report.removed.push(`${baseName} — Image irréparable`);
          }
          continue;
        }

        // ===== AUDIO MP3 - validation only =====
        if (ext === '.mp3') {
          if (isValidMp3(fileData)) {
            // MP3 valide - garder tel quel
            newZip.addFile(entry.entryName, fileData);
          } else if (fileData.length > 1000) {
            // MP3 avec headers non standards mais données présentes - garder tel quel
            // (certains encodeurs MP3 utilisent des headers non conventionnels)
            newZip.addFile(entry.entryName, fileData);
            report.skipped.push(`${baseName} — Audio MP3 conservé (headers non standards)`);
          } else {
            report.removed.push(`${baseName} — Audio corrompu (fichier trop petit: ${fileData.length} octets)`);
          }
          continue;
        }

        // ===== VIDEO MP4 - validation only =====
        if (ext === '.mp4') {
          if (isValidMp4(fileData)) {
            // MP4 valide - garder tel quel
            newZip.addFile(entry.entryName, fileData);
          } else if (fileData.length > 10000) {
            // MP4 avec container non standard mais données présentes - garder tel quel
            newZip.addFile(entry.entryName, fileData);
            report.skipped.push(`${baseName} — Vidéo MP4 conservée (container non standard)`);
          } else {
            report.removed.push(`${baseName} — Vidéo corrompue (fichier trop petit: ${fileData.length} octets)`);
          }
          continue;
        }

        // Autres fichiers — garder tel quel
        newZip.addFile(entry.entryName, fileData);
      }

      // Create repaired ZIP buffer
      const repairedBuffer = newZip.toBuffer();

      // Save repaired ZIP back to temp storage (replace original)
      if (importId && !zipBufferBase64) {
        const job = await getUploadJob(importId);
        if (job) {
          try {
            await saveUploadJob(importId, repairedBuffer, job);
          } catch {
            console.error('Failed to save repaired ZIP to temp storage');
          }
        }
      }

      return NextResponse.json({
        success: true,
        report,
        summary: {
          totalRepaired: report.repaired.length,
          totalRemoved: report.removed.length,
          totalSkipped: report.skipped.length,
        },
        zipBuffer: repairedBuffer.toString('base64'),
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Repair error:', error);
    return NextResponse.json({ error: 'Réparation échouée: ' + (error as Error).message }, { status: 500 });
  }
}

function isValidImage(data: Buffer): boolean {
  if (data.length < 8) return false;
  const h = data.slice(0, 16);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) return true; // PNG
  if (h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF) return true; // JPEG
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38) return true; // GIF
  if (h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46) return true; // WebP/RIFF
  if (h[0] === 0x42 && h[1] === 0x4D) return true; // BMP
  return false;
}

function isValidMp3(data: Buffer): boolean {
  if (data.length < 10) return false;
  // ID3 tag header
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) return true;
  // MPEG audio frame sync (11 bits set)
  if (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) return true;
  return false;
}

function isValidMp4(data: Buffer): boolean {
  if (data.length < 12) return false;
  // Check for common MP4 box types
  const ftyp = data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
  const moov = data[4] === 0x6D && data[5] === 0x6F && data[6] === 0x6F && data[7] === 0x76;
  const mdat = data[4] === 0x6D && data[5] === 0x64 && data[6] === 0x61 && data[7] === 0x74;
  // Also check at offset 0 for ftyp in some MP4 variants
  const ftyp0 = data[0] === 0x66 && data[1] === 0x74 && data[2] === 0x79 && data[3] === 0x70;
  return ftyp || moov || mdat || ftyp0;
}
