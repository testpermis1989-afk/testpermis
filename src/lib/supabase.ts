import { createClient } from '@supabase/supabase-js'

// Supabase configuration - uses env vars with hardcoded fallbacks for Vercel deployment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kiydexwjjhzjynxddqhc.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_CyUCL1H-hxCENCFiSmAMeA_jqeo1R8i'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Helper to get public URL for a file in the uploads bucket
export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from('uploads').getPublicUrl(path)
  return data.publicUrl
}

// Helper to upload a file to Supabase Storage
export async function uploadFile(path: string, file: Buffer | Uint8Array | ArrayBuffer, contentType?: string): Promise<string> {
  const { data, error } = await supabase.storage.from('uploads').upload(path, file, {
    contentType,
    upsert: true,
  })
  if (error) throw error
  return data.path
}

// Helper to delete a file from Supabase Storage
export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from('uploads').remove([path])
  if (error) throw error
}

// Helper to delete a folder from Supabase Storage (lists all files then removes them)
export async function deleteFolder(prefix: string): Promise<void> {
  const { data, error } = await supabase.storage.from('uploads').list(prefix)
  if (error) throw error
  if (data && data.length > 0) {
    const paths = data.map(f => `${prefix}/${f.name}`)
    const { error: removeError } = await supabase.storage.from('uploads').remove(paths)
    if (removeError) throw removeError
  }
}

// Helper to download a file from Supabase Storage
export async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from('uploads').download(path)
  if (error) throw error
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// Helper to list files in a Supabase Storage folder
export async function listFiles(prefix: string): Promise<string[]> {
  const files: string[] = []
  let currentPage = prefix
  while (true) {
    const { data, error } = await supabase.storage.from('uploads').list(currentPage)
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

// Convert a legacy local path (e.g. /uploads/A/1/images/q1.png) to Supabase storage path (series/A/1/images/q1.png)
// and return the full public URL
export function toSupabaseUrl(localPath: string | null | undefined): string {
  if (!localPath) return ''
  // If it's already a full URL, return as-is
  if (localPath.startsWith('http')) return localPath
  // Convert /uploads/A/1/images/q1.png → series/A/1/images/q1.png
  const storagePath = localPath.replace(/^\/uploads\//, 'series/')
  return getPublicUrl(storagePath)
}

// Convert legacy local path to Supabase storage path (without getting public URL)
export function toStoragePath(localPath: string | null | undefined): string {
  if (!localPath) return ''
  if (localPath.startsWith('http')) return localPath
  return localPath.replace(/^\/uploads\//, 'series/')
}
