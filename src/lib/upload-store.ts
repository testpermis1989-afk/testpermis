// Upload store - supports both Supabase (cloud) and local filesystem (Electron) modes
// Cloud mode: stores temp uploads in Supabase Storage
// Local mode: stores temp uploads on local filesystem

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

const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR || 'data';

async function getLocalTempDir(): Promise<string> {
  const path = await import('path');
  return path.join(LOCAL_DATA_DIR, 'temp-uploads');
}

async function ensureLocalDir(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const dir = await getLocalTempDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function saveLocalUploadJob(importId: string, zipBuffer: Buffer, metadata: UploadJob): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  ensureLocalDir();
  const dir = await getLocalTempDir();
  fs.writeFileSync(path.join(dir, `${importId}.zip`), zipBuffer);
  fs.writeFileSync(path.join(dir, `${importId}.json`), JSON.stringify(metadata));
}

async function getLocalUploadBuffer(importId: string): Promise<Buffer | null> {
  const fs = await import('fs');
  const path = await import('path');
  const dir = await getLocalTempDir();
  const fullPath = path.join(dir, `${importId}.zip`);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}

async function deleteLocalUploadJob(importId: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const dir = await getLocalTempDir();
  try { fs.unlinkSync(path.join(dir, `${importId}.zip`)); } catch {}
  try { fs.unlinkSync(path.join(dir, `${importId}.json`)); } catch {}
}

async function hasLocalUploadJob(importId: string): Promise<boolean> {
  const fs = await import('fs');
  const path = await import('path');
  const dir = await getLocalTempDir();
  return fs.existsSync(path.join(dir, `${importId}.zip`));
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
    const fs = await import('fs');
    const path = await import('path');
    const dir = await getLocalTempDir();
    const metaPath = path.join(dir, `${importId}.json`);
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
