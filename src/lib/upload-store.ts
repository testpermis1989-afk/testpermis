// Upload store - supports both Supabase (cloud) and local filesystem (Electron) modes
import fs from 'fs';
import path from 'path';

const STORAGE_MODE = (process.env.STORAGE_MODE || 'supabase') as 'supabase' | 'local';

interface UploadJob {
  categoryCode: string;
  serieNumber: string;
  fileName: string;
  fileSize: string;
  verified: boolean;
  createdAt: number;
}

// ========== LOCAL STORAGE (Electron mode) ==========

const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(process.cwd(), 'data');
const LOCAL_TEMP_DIR = path.join(LOCAL_DATA_DIR, 'temp-uploads');

function ensureLocalDir(): void {
  if (!fs.existsSync(LOCAL_TEMP_DIR)) {
    fs.mkdirSync(LOCAL_TEMP_DIR, { recursive: true });
  }
}

async function saveLocalUploadJob(importId: string, zipBuffer: Buffer, metadata: UploadJob): Promise<void> {
  ensureLocalDir();
  fs.writeFileSync(path.join(LOCAL_TEMP_DIR, `${importId}.zip`), zipBuffer);
  fs.writeFileSync(path.join(LOCAL_TEMP_DIR, `${importId}.json`), JSON.stringify(metadata));
}

async function getLocalUploadBuffer(importId: string): Promise<Buffer | null> {
  const fullPath = path.join(LOCAL_TEMP_DIR, `${importId}.zip`);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}

async function deleteLocalUploadJob(importId: string): Promise<void> {
  try {
    fs.unlinkSync(path.join(LOCAL_TEMP_DIR, `${importId}.zip`));
  } catch {}
  try {
    fs.unlinkSync(path.join(LOCAL_TEMP_DIR, `${importId}.json`));
  } catch {}
}

async function hasLocalUploadJob(importId: string): Promise<boolean> {
  return fs.existsSync(path.join(LOCAL_TEMP_DIR, `${importId}.zip`));
}

// ========== SUPABASE STORAGE (cloud mode) ==========

async function saveSupabaseUploadJob(importId: string, zipBuffer: Buffer, metadata: UploadJob): Promise<void> {
  const { supabase } = await import('./supabase');
  const { error: bufError } = await supabase.storage
    .from('uploads')
    .upload(`temp-uploads/${importId}.zip`, zipBuffer, {
      contentType: 'application/zip',
      upsert: true,
    });
  if (bufError) throw new Error(`Failed to save temp ZIP: ${bufError.message}`);

  const { error: metaError } = await supabase.storage
    .from('uploads')
    .upload(`temp-uploads/${importId}.json`, JSON.stringify(metadata), {
      contentType: 'application/json',
      upsert: true,
    });
  if (metaError) throw new Error(`Failed to save temp metadata: ${metaError.message}`);
}

async function getSupabaseUploadBuffer(importId: string): Promise<Buffer | null> {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.storage
    .from('uploads')
    .download(`temp-uploads/${importId}.zip`);
  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function deleteSupabaseUploadJob(importId: string): Promise<void> {
  const { supabase } = await import('./supabase');
  await supabase.storage
    .from('uploads')
    .remove([
      `temp-uploads/${importId}.zip`,
      `temp-uploads/${importId}.json`,
    ]);
}

async function hasSupabaseUploadJob(importId: string): Promise<boolean> {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.storage
    .from('uploads')
    .list('temp-uploads', { search: `${importId}.` });
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

// ========== PUBLIC API ==========

export async function saveUploadJob(importId: string, zipBuffer: Buffer, metadata: UploadJob): Promise<void> {
  if (STORAGE_MODE === 'local') {
    return saveLocalUploadJob(importId, zipBuffer, metadata);
  }
  return saveSupabaseUploadJob(importId, zipBuffer, metadata);
}

export async function getUploadBuffer(importId: string): Promise<Buffer | null> {
  if (STORAGE_MODE === 'local') {
    return getLocalUploadBuffer(importId);
  }
  return getSupabaseUploadBuffer(importId);
}

export async function deleteUploadJob(importId: string): Promise<void> {
  if (STORAGE_MODE === 'local') {
    return deleteLocalUploadJob(importId);
  }
  return deleteSupabaseUploadJob(importId);
}

export async function getUploadJob(importId: string): Promise<UploadJob | null> {
  if (STORAGE_MODE === 'local') {
    const metaPath = path.join(LOCAL_TEMP_DIR, `${importId}.json`);
    if (!fs.existsSync(metaPath)) return null;
    const content = fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(content) as UploadJob;
  }
  // Supabase mode
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.storage
    .from('uploads')
    .download(`temp-uploads/${importId}.json`);
  if (error || !data) return null;
  const content = await data.text();
  return JSON.parse(content) as UploadJob;
}

export async function hasUploadJob(importId: string): Promise<boolean> {
  if (STORAGE_MODE === 'local') {
    return hasLocalUploadJob(importId);
  }
  return hasSupabaseUploadJob(importId);
}
