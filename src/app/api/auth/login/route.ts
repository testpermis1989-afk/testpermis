import { NextRequest, NextResponse } from 'next/server'

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

    // admin/admin123 always works - NO database dependency at all
    if (cin.toLowerCase() === 'admin' && password === 'admin123') {
      return NextResponse.json({
        user: {
          id: 'admin-001',
          cin: 'ADMIN',
          nomFr: 'Administrateur',
          prenomFr: 'Système',
          nomAr: null,
          prenomAr: null,
          photo: null,
          permisCategory: 'ALL',
          examDate: null,
          pinCode: '0000',
          isActive: true,
          role: 'admin',
        },
      });
    }

    // For non-admin users, load database lazily (only when needed)
    let db: any;
    try {
      const mod = await import('@/lib/db');
      db = mod.db;
    } catch (dbError) {
      console.error('Database not available:', dbError);
      return NextResponse.json(
        { error: 'Base de données non disponible. Utilisez admin/admin123 pour la première connexion.' },
        { status: 503 }
      );
    }

    const user = await db.user.findUnique({
      where: { cin: cin.trim().toUpperCase() },
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
        try {
          await db.user.update({
            where: { cin },
            data: { isActive: false },
          });
        } catch { /* ignore update error */ }
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
    console.error('Login error details:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
