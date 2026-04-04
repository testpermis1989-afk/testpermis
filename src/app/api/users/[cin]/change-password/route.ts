import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cin: string }> }
) {
  try {
    const { cin } = await params
    const { oldPassword, newPassword } = await request.json()

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Ancien et nouveau mot de passe sont requis' },
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

    if (user.password !== oldPassword) {
      return NextResponse.json(
        { error: 'Ancien mot de passe incorrect' },
        { status: 401 }
      )
    }

    await db.user.update({
      where: { cin },
      data: { password: newPassword },
    })

    return NextResponse.json({ message: 'Mot de passe modifié' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
