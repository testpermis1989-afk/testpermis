// Local storage adapter - uses Node.js filesystem instead of Supabase Storage
// Used when STORAGE_MODE=local (Electron / local deployment)

import fs from 'fs';
import path from 'path';

// Base directory for all local media files
const DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure directories exist
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Convert a Supabase-style storage path to a local filesystem path
// e.g. "series/A/1/images/q1.png" → "/data/uploads/series/A/1/images/q1.png"
function toLocalPath(storagePath: string): string {
  return path.join(UPLOADS_DIR, storagePath);
}

// Convert Supabase-style prefix to local directory path
function toLocalDir(prefix: string): string {
  return path.join(UPLOADS_DIR, prefix);
}

/**
 * Upload a file to local storage
 */
export async function uploadFile(
  storagePath: string,
  file: Buffer | Uint8Array | ArrayBuffer,
  contentType?: string
): Promise<string> {
  const fullPath = toLocalPath(storagePath);
  ensureDir(path.dirname(fullPath));

  const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
  fs.writeFileSync(fullPath, buffer);

  return storagePath; // Return the storage path (not filesystem path)
}

/**
 * Get a publicly accessible URL for a local file
 * Returns a relative URL that can be served by the /api/serve/[...path] route
 */
export function getPublicUrl(storagePath: string): string {
  if (!storagePath) return '';
  if (storagePath.startsWith('http')) return storagePath; // Already a full URL
  return `/api/serve/${storagePath}`;
}

/**
 * Delete a file from local storage
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const fullPath = toLocalPath(storagePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

/**
 * Delete all files in a folder
 */
export async function deleteFolder(prefix: string): Promise<void> {
  const dirPath = toLocalDir(prefix);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Download a file from local storage
 */
export async function downloadFile(storagePath: string): Promise<Buffer> {
  const fullPath = toLocalPath(storagePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${storagePath}`);
  }
  return fs.readFileSync(fullPath);
}

/**
 * List files in a folder
 */
export async function listFiles(prefix: string): Promise<string[]> {
  const dirPath = toLocalDir(prefix);
  const files: string[] = [];

  if (!fs.existsSync(dirPath)) return files;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name) {
      files.push(entry.name);
    }
  }

  return files;
}

/**
 * Check if a file exists
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  const fullPath = toLocalPath(storagePath);
  return fs.existsSync(fullPath);
}

/**
 * Get file size in bytes
 */
export function getFileSize(storagePath: string): number {
  const fullPath = toLocalPath(storagePath);
  if (!fs.existsSync(fullPath)) return 0;
  return fs.statSync(fullPath).size;
}

/**
 * Get total size of a folder
 */
export function getFolderSize(prefix: string): number {
  const dirPath = toLocalDir(prefix);
  if (!fs.existsSync(dirPath)) return 0;

  let totalSize = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      totalSize += fs.statSync(path.join(dirPath, entry.name)).size;
    }
  }
  return totalSize;
}

/**
 * Copy a file within local storage
 */
export async function copyFile(srcPath: string, destPath: string): Promise<void> {
  const srcFull = toLocalPath(srcPath);
  const destFull = toLocalPath(destPath);
  ensureDir(path.dirname(destFull));
  fs.copyFileSync(srcFull, destFull);
}
