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

    // Fallback: si aucun admin dans la DB, permettre admin/admin123
    if (cin.toLowerCase() === 'admin' && password === 'admin123') {
      const adminCount = await db.user.count({ where: { role: 'admin' } });
      if (adminCount === 0) {
        return NextResponse.json({
          user: {
            id: 'fallback-admin',
            cin: 'ADMIN',
            nomFr: 'Administrateur',
            prenomFr: 'Système',
            nomAr: null,
            prenomAr: null,
            photo: null,
            permisCategory: 'ALL',
            examDate: null,
            pinCode: '',
            isActive: true,
            role: 'admin',
          },
        })
      }
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

    // Désactivation automatique si la date d'examen est atteinte ou dépassée
    if (user.examDate && user.isActive) {
      const nowMorocco = new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca' });
      const todayMorocco = new Date(nowMorocco);
      todayMorocco.setHours(0, 0, 0, 0);
      const examDate = new Date(user.examDate + 'T00:00:00');
      if (examDate <= todayMorocco) {
        await db.user.update({
          where: { cin },
          data: { isActive: false },
        });
        return NextResponse.json(
          { error: 'Compte désactivé - la date de votre examen est passée' },
          { status: 403 }
        )
      }
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
