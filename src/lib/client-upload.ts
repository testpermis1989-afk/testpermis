// Stub for client-upload - only used in cloud/Supabase mode
// In desktop/local mode, uploads go through the local API routes
export async function uploadZipToStorage(
  _file: File,
  _category: string,
  _serie: string
): Promise<{ importId?: string; error?: string }> {
  return { error: 'Upload to cloud not available in desktop mode' };
}
