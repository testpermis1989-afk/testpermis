import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Only available in local mode
    if (process.env.STORAGE_MODE !== 'local') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    // Get the current activation record (latest one)
    const activation = await db.activation.findFirst({
      orderBy: { activatedAt: 'desc' },
    });

    // No activation record found
    if (!activation) {
      return NextResponse.json({ activated: false });
    }

    // Check if the activation is expired
    const expiresAt = new Date(activation.expiresAt);
    const now = new Date();

    if (now > expiresAt) {
      return NextResponse.json({
        activated: false,
        expired: true,
        expiresAt: expiresAt.toISOString(),
      });
    }

    // Activation is valid
    return NextResponse.json({
      activated: true,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to check activation status:', error);
    return NextResponse.json(
      { error: 'Failed to check activation status' },
      { status: 500 }
    );
  }
}
