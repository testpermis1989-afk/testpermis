// Upload utility - supports both Supabase (cloud) and local (Electron) modes
// Cloud mode: uploads ZIP directly to Supabase Storage from browser
// Local mode: sends ZIP to a local API endpoint

const STORAGE_MODE = process.env.NEXT_PUBLIC_STORAGE_MODE || (process.env.NEXT_PUBLIC_SUPABASE_URL ? 'supabase' : 'local');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiydexwjjhzjynxddqhc.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CyUCL1H-hxCENCFiSmAMeA_jqeo1R8i';

interface UploadResult {
  importId: string;
  error?: string;
}

export async function uploadZipToStorage(
  file: File,
  categoryCode: string,
  serieNumber: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  if (STORAGE_MODE === 'local') {
    return uploadToLocalServer(file, categoryCode, serieNumber);
  }
  return uploadToSupabase(file, categoryCode, serieNumber);
}

// ========== LOCAL MODE ==========

async function uploadToLocalServer(file: File, categoryCode: string, serieNumber: string): Promise<UploadResult> {
  const importId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('importId', importId);
    formData.append('categoryCode', categoryCode);
    formData.append('serieNumber', serieNumber);

    const response = await fetch('/api/upload/temp', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Local upload error:', response.status, errorText);
      return { importId, error: `Erreur d'upload local (${response.status}): ${errorText.substring(0, 200)}` };
    }

    return { importId };
  } catch (error) {
    console.error('Upload error:', error);
    return { importId, error: `Erreur réseau: ${(error as Error).message}` };
  }
}

// ========== SUPABASE MODE ==========

let _browserClient: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null;

async function getBrowserClient() {
  if (!_browserClient) {
    const { createClient } = await import('@supabase/supabase-js');
    _browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _browserClient;
}

async function uploadToSupabase(file: File, categoryCode: string, serieNumber: string): Promise<UploadResult> {
  const importId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const client = await getBrowserClient();
    const arrayBuffer = await file.arrayBuffer();

    const supabasePath = `temp-uploads/${importId}.zip`;
    const { error: uploadError } = await client.storage
      .from('uploads')
      .upload(supabasePath, arrayBuffer, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { importId, error: `Erreur d'upload: ${uploadError.message}` };
    }

    const metadata = JSON.stringify({
      categoryCode,
      serieNumber,
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      verified: false,
      createdAt: Date.now(),
    });

    const metaPath = `temp-uploads/${importId}.json`;
    await client.storage.from('uploads').upload(metaPath, metadata, {
      contentType: 'application/json',
      upsert: true,
    }).catch(err => console.error('Metadata upload error (non-critical):', err));

    return { importId };
  } catch (error) {
    console.error('Upload error:', error);
    return { importId, error: `Erreur réseau: ${(error as Error).message}` };
  }
}
