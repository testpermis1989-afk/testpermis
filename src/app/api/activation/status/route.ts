import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/activation/status
 * Secondary activation status check (legacy endpoint).
 * Also includes anti-clock-tampering protection.
 */
export async function GET() {
  try {
    // Only available in local mode
    if (process.env.STORAGE_MODE !== 'local') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    // Get the current activation record (latest one)
    const activation = await db.activation.findFirst();

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

    // Anti-clock-tampering check (same logic as /api/license)
    const CLOCK_TOLERANCE_MS = 10 * 60 * 1000; // 10 minutes
    const nowMs = Date.now();

    if (activation.lastCheckedAt) {
      const lastCheckedMs = new Date(activation.lastCheckedAt).getTime();
      if (nowMs < lastCheckedMs - CLOCK_TOLERANCE_MS) {
        return NextResponse.json({
          activated: false,
          tampered: true,
          expiresAt: expiresAt.toISOString(),
          message: "Manipulation de l'horloge systeme detectee.",
        });
      }
    }

    // Update lastCheckedAt
    await db.activation.update({
      where: {},
      data: { lastCheckedAt: new Date(nowMs).toISOString() },
    });

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
