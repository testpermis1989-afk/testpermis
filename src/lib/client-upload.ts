// Upload utility - uploads ZIP directly to Supabase Storage from the browser
// This avoids Vercel's 4.5MB body size limit

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiydexwjjhzjynxddqhc.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CyUCL1H-hxCENCFiSmAMeA_jqeo1R8i';

/**
 * Upload a file directly to Supabase Storage from the browser
 * Returns the importId that can be used for verify/compress/import
 */
export async function uploadZipToStorage(
  file: File,
  categoryCode: string,
  serieNumber: string,
  onProgress?: (percent: number) => void
): Promise<{ importId: string; error?: string }> {
  const importId = `imp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    // Create a FormData for Supabase Storage upload
    const arrayBuffer = await file.arrayBuffer();
    
    // Use Supabase REST API directly (no SDK needed on client)
    const supabasePath = `temp-uploads/${importId}.zip`;
    const uploadUrl = `${SUPABASE_URL}/rest/v1/rpc/`; // Not used - use storage API directly
    
    // Actually use the Supabase Storage upload API
    const storageUrl = `${SUPABASE_URL}/storage/v1/object/uploads/${supabasePath}`;
    
    const response = await fetch(storageUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': file.type || 'application/zip',
        'x-upsert': 'true',
        'Content-Length': file.size.toString(),
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Storage upload error:', errorText);
      return { importId, error: `Erreur d'upload: ${response.status}` };
    }

    // Also save metadata as JSON
    const metadata = JSON.stringify({
      categoryCode,
      serieNumber,
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      verified: false,
      createdAt: Date.now(),
    });

    const metaPath = `temp-uploads/${importId}.json`;
    const metaUrl = `${SUPABASE_URL}/storage/v1/object/uploads/${metaPath}`;

    await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: metadata,
    });

    return { importId };
  } catch (error) {
    console.error('Upload error:', error);
    return { importId, error: `Erreur: ${(error as Error).message}` };
  }
}
