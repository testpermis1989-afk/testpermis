import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cin: string }> }
) {
  try {
    const { cin } = await params

    const user = await db.user.findUnique({
      where: { cin },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cin: string }> }
) {
  try {
    const { cin } = await params
    const body = await request.json()

    const existing = await db.user.findUnique({
      where: { cin },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    const {
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
      role,
    } = body

    const user = await db.user.update({
      where: { cin },
      data: {
        ...(password !== undefined && { password }),
        ...(nomFr !== undefined && { nomFr }),
        ...(prenomFr !== undefined && { prenomFr }),
        ...(nomAr !== undefined && { nomAr }),
        ...(prenomAr !== undefined && { prenomAr }),
        ...(photo !== undefined && { photo }),
        ...(permisCategory !== undefined && { permisCategory }),
        ...(examDate !== undefined && { examDate }),
        ...(pinCode !== undefined && { pinCode }),
        ...(isActive !== undefined && { isActive }),
        ...(role !== undefined && { role }),
      },
    })

    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ cin: string }> }
) {
  try {
    const { cin } = await params

    const existing = await db.user.findUnique({
      where: { cin },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    await db.user.delete({
      where: { cin },
    })

    return NextResponse.json({ message: 'Utilisateur supprimé' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
