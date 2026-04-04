import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cin: string }> }
) {
  try {
    const { cin } = await params
    const { pin } = await request.json()

    if (!pin) {
      return NextResponse.json(
        { error: 'PIN est requis' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { cin },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    await db.user.update({
      where: { cin },
      data: { pinCode: pin },
    })

    return NextResponse.json({ message: 'PIN modifié' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
