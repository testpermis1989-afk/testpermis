import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'photos')

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

    await mkdir(UPLOAD_DIR, { recursive: true })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileName = `${cin}.${ext}`
    const filePath = path.join(UPLOAD_DIR, fileName)

    await writeFile(filePath, buffer)

    const photoUrl = `/uploads/photos/${fileName}`

    return NextResponse.json({ photo: photoUrl })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur lors du téléchargement' },
      { status: 500 }
    )
  }
}
