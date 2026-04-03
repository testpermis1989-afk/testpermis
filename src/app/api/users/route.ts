import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        cin: true,
        nomFr: true,
        prenomFr: true,
        nomAr: true,
        prenomAr: true,
        photo: true,
        permisCategory: true,
        examDate: true,
        pinCode: true,
        isActive: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      cin,
      password,
      nomFr,
      prenomFr,
      nomAr,
      prenomAr,
      photo,
      permisCategory,
      examDate,
      pinCode,
      isActive,
    } = body

    if (!cin) {
      return NextResponse.json(
        { error: 'CIN est requis' },
        { status: 400 }
      )
    }

    const existing = await db.user.findUnique({
      where: { cin },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Un utilisateur avec ce CIN existe déjà' },
        { status: 409 }
      )
    }

    const user = await db.user.create({
      data: {
        cin,
        password: password || '1234',
        nomFr: nomFr ?? undefined,
        prenomFr: prenomFr ?? undefined,
        nomAr: nomAr ?? undefined,
        prenomAr: prenomAr ?? undefined,
        photo: photo ?? undefined,
        permisCategory: permisCategory ?? 'B',
        examDate: examDate ?? undefined,
        pinCode: pinCode ?? '',
        isActive: isActive ?? true,
      },
    })

    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({ user: userWithoutPassword }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
