import { supabase } from './supabase'

/**
 * Upload store - persists ZIP buffers in Supabase Storage between serverless invocations.
 * On Vercel, each API route invocation has separate memory, so in-memory Maps don't work.
 * Instead, we store the ZIP buffer temporarily in Supabase Storage.
 */

const TEMP_BUCKET = 'uploads'
const TEMP_PREFIX = 'temp-uploads/'

// Store metadata alongside the buffer
interface UploadJob {
  categoryCode: string
  serieNumber: string
  fileName: string
  fileSize: string
  verified: boolean
  createdAt: number
}

/**
 * Save a ZIP buffer to temp storage with metadata
 */
export async function saveUploadJob(
  importId: string,
  zipBuffer: Buffer,
  metadata: UploadJob
): Promise<void> {
  // Save ZIP buffer
  const { error: bufError } = await supabase.storage
    .from(TEMP_BUCKET)
    .upload(`${TEMP_PREFIX}${importId}.zip`, zipBuffer, {
      contentType: 'application/zip',
      upsert: true,
    })
  if (bufError) throw new Error(`Failed to save temp ZIP: ${bufError.message}`)

  // Save metadata
  const { error: metaError } = await supabase.storage
    .from(TEMP_BUCKET)
    .upload(
      `${TEMP_PREFIX}${importId}.json`,
      JSON.stringify(metadata),
      {
        contentType: 'application/json',
        upsert: true,
      }
    )
  if (metaError) throw new Error(`Failed to save temp metadata: ${metaError.message}`)
}

/**
 * Retrieve a ZIP buffer from temp storage
 */
export async function getUploadBuffer(importId: string): Promise<Buffer | null> {
  const { data, error } = await supabase.storage
    .from(TEMP_BUCKET)
    .download(`${TEMP_PREFIX}${importId}.zip`)

  if (error || !data) return null
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Retrieve metadata for an upload job
 */
export async function getUploadJob(importId: string): Promise<UploadJob | null> {
  const { data, error } = await supabase.storage
    .from(TEMP_BUCKET)
    .download(`${TEMP_PREFIX}${importId}.json`)

  if (error || !data) return null
  const text = await data.text()
  return JSON.parse(text) as UploadJob
}

/**
 * Delete temp files for an upload job
 */
export async function deleteUploadJob(importId: string): Promise<void> {
  await supabase.storage
    .from(TEMP_BUCKET)
    .remove([
      `${TEMP_PREFIX}${importId}.zip`,
      `${TEMP_PREFIX}${importId}.json`,
    ])
}

/**
 * Check if an upload job exists
 */
export async function hasUploadJob(importId: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(TEMP_BUCKET)
    .list(TEMP_PREFIX, {
      search: `${importId}.`,
    })

  if (error) return false
  return (data?.length ?? 0) > 0
}
