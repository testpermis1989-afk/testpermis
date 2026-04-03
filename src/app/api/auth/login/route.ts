import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cin, password } = body

    if (!cin || !password) {
      return NextResponse.json(
        { error: 'CIN et mot de passe sont requis' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { cin },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'CIN ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    if (user.password !== password) {
      return NextResponse.json(
        { error: 'CIN ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Compte désactivé' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        cin: user.cin,
        nomFr: user.nomFr,
        prenomFr: user.prenomFr,
        nomAr: user.nomAr,
        prenomAr: user.prenomAr,
        photo: user.photo,
        permisCategory: user.permisCategory,
        examDate: user.examDate,
        pinCode: user.pinCode,
        isActive: user.isActive,
        role: user.role,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
