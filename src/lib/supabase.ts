import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiydexwjjhzjynxddqhc.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CyUCL1H-hxCENCFiSmAMeA_jqeo1R8i'

// Storage mode: 'supabase' (cloud) or 'local' (filesystem/Electron)
export const STORAGE_MODE = (process.env.STORAGE_MODE || 'supabase') as 'supabase' | 'local'

// Initialize Supabase client only if needed
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return _supabase
}
export const supabase = STORAGE_MODE === 'supabase' ? getSupabase() : null

// =====================================================
// Storage functions - switch between Supabase / Local
// =====================================================

/**
 * Get public URL for a file
 */
export function getPublicUrl(storagePath: string): string {
  if (!storagePath) return ''
  if (storagePath.startsWith('http')) return storagePath

  if (STORAGE_MODE === 'local') {
    return `/api/serve/${storagePath}`
  }

  const client = getSupabase()
  const { data } = client.storage.from('uploads').getPublicUrl(storagePath)
  return data.publicUrl
}

/**
 * Upload a file
 */
export async function uploadFile(storagePath: string, file: Buffer | Uint8Array | ArrayBuffer, contentType?: string): Promise<string> {
  if (STORAGE_MODE === 'local') {
    const { uploadFile: localUpload } = await import('./local-storage')
    return localUpload(storagePath, file, contentType)
  }

  const client = getSupabase()
  const { data, error } = await client.storage.from('uploads').upload(storagePath, file, {
    contentType,
    upsert: true,
  })
  if (error) throw error
  return data.path
}

/**
 * Delete a file
 */
export async function deleteFile(storagePath: string): Promise<void> {
  if (STORAGE_MODE === 'local') {
    const { deleteFile: localDelete } = await import('./local-storage')
    return localDelete(storagePath)
  }

  const client = getSupabase()
  const { error } = await client.storage.from('uploads').remove([storagePath])
  if (error) throw error
}

/**
 * Delete all files in a folder
 */
export async function deleteFolder(prefix: string): Promise<void> {
  if (STORAGE_MODE === 'local') {
    const { deleteFolder: localDeleteFolder } = await import('./local-storage')
    return localDeleteFolder(prefix)
  }

  const client = getSupabase()
  const { data, error } = await client.storage.from('uploads').list(prefix)
  if (error) throw error
  if (data && data.length > 0) {
    const paths = data.map(f => `${prefix}/${f.name}`)
    const { error: removeError } = await client.storage.from('uploads').remove(paths)
    if (removeError) throw removeError
  }
}

/**
 * Download a file
 */
export async function downloadFile(storagePath: string): Promise<Buffer> {
  if (STORAGE_MODE === 'local') {
    const { downloadFile: localDownload } = await import('./local-storage')
    return localDownload(storagePath)
  }

  const client = getSupabase()
  const { data, error } = await client.storage.from('uploads').download(storagePath)
  if (error) throw error
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * List files in a folder
 */
export async function listFiles(prefix: string): Promise<string[]> {
  if (STORAGE_MODE === 'local') {
    const { listFiles: localList } = await import('./local-storage')
    return localList(prefix)
  }

  const client = getSupabase()
  const files: string[] = []
  let currentPage = prefix
  while (true) {
    const { data, error } = await client.storage.from('uploads').list(currentPage)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const f of data) {
      if (!f.id) continue
      files.push(f.name)
    }
    break
  }
  return files
}

/**
 * Convert a legacy local path to Supabase URL
 */
export function toSupabaseUrl(localPath: string | null | undefined): string {
  if (!localPath) return ''
  if (localPath.startsWith('http')) return localPath
  const storagePath = localPath.replace(/^\/uploads\//, 'series/')
  return getPublicUrl(storagePath)
}

/**
 * Convert legacy local path to storage path
 */
export function toStoragePath(localPath: string | null | undefined): string {
  if (!localPath) return ''
  if (localPath.startsWith('http')) return localPath
  return localPath.replace(/^\/uploads\//, 'series/')
}
