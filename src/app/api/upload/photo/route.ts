import { NextRequest, NextResponse } from 'next/server'
import { uploadFile, getPublicUrl } from '@/lib/supabase'

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const cin = formData.get('cin') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'Fichier requis' },
        { status: 400 }
      )
    }

    if (!cin) {
      return NextResponse.json(
        { error: 'CIN est requis' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: 'Format de fichier non supporté' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileName = `${cin}.${ext}`
    const storagePath = `photos/${fileName}`
    const contentType = MIME_TYPES[ext] || 'image/jpeg'

    await uploadFile(storagePath, buffer, contentType)

    const photoUrl = getPublicUrl(storagePath)

    return NextResponse.json({ photo: photoUrl })
  } catch (error) {
    console.error('Photo upload error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du téléchargement' },
      { status: 500 }
    )
  }
}
