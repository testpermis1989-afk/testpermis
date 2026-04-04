// Upload utility - uploads ZIP directly to Supabase Storage from the browser
// This avoids Vercel's 4.5MB body size limit
// Uses the Supabase JS client for proper authentication and CORS handling

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiydexwjjhzjynxddqhc.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CyUCL1H-hxCENCFiSmAMeA_jqeo1R8i';

// Lazy-initialized Supabase client for browser use
let _browserClient: ReturnType<typeof createClient> | null = null;
function getBrowserClient() {
  if (!_browserClient) {
    _browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _browserClient;
}

interface UploadResult {
  importId: string;
  error?: string;
}

/**
 * Upload a ZIP file directly to Supabase Storage from the browser.
 * Returns the importId that can be used for verify/compress/import.
 */
export async function uploadZipToStorage(
  file: File,
  categoryCode: string,
  serieNumber: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const importId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const client = getBrowserClient();
    const arrayBuffer = await file.arrayBuffer();

    // Upload ZIP file to temp-uploads/ in the 'uploads' bucket
    const supabasePath = `temp-uploads/${importId}.zip`;
    const { data: uploadData, error: uploadError } = await client.storage
      .from('uploads')
      .upload(supabasePath, arrayBuffer, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return {
        importId,
        error: `Erreur d'upload: ${uploadError.message}`
      };
    }

    // Save metadata as JSON file alongside the ZIP
    const metadata = JSON.stringify({
      categoryCode,
      serieNumber,
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      verified: false,
      createdAt: Date.now(),
    });

    const metaPath = `temp-uploads/${importId}.json`;
    const { error: metaError } = await client.storage
      .from('uploads')
      .upload(metaPath, metadata, {
        contentType: 'application/json',
        upsert: true,
      });

    if (metaError) {
      console.error('Metadata upload error (non-critical):', metaError);
      // ZIP was uploaded OK, metadata failed - not critical for verification
    }

    return { importId };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      importId,
      error: `Erreur réseau: ${(error as Error).message}`
    };
  }
}
