import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MAX_STALE_CHECKS = 3;
const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;

/**
 * GET /api/activation/status
 * Secondary activation status check (legacy endpoint).
 * Includes same anti-clock-tampering protection as /api/license.
 */
export async function GET() {
  try {
    // Only available in local mode
    if (process.env.STORAGE_MODE !== 'local') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    const activation = await db.activation.findFirst();

    if (!activation) {
      return NextResponse.json({ activated: false });
    }

    const expiresAt = new Date(activation.expiresAt);
    const now = new Date();

    if (now > expiresAt) {
      return NextResponse.json({
        activated: false,
        expired: true,
        expiresAt: expiresAt.toISOString(),
      });
    }

    // Anti-clock-tampering (same 3-layer logic as /api/license)
    const nowMs = Date.now();
    const staleCount = activation.staleCheckCount || 0;

    if (activation.lastCheckedAt) {
      const lastCheckedMs = new Date(activation.lastCheckedAt).getTime();

      // Layer 2: Backward clock
      if (nowMs < lastCheckedMs - CLOCK_TOLERANCE_MS) {
        await db.activation.update({
          where: {},
          data: { staleCheckCount: staleCount + 1 },
        });
        return NextResponse.json({
          activated: false,
          tampered: true,
          expiresAt: expiresAt.toISOString(),
          message: "Manipulation de l'horloge systeme detectee.",
        });
      }

      // Layer 3: Stuck clock
      if (nowMs <= lastCheckedMs + CLOCK_TOLERANCE_MS) {
        const newStaleCount = staleCount + 1;
        if (newStaleCount >= MAX_STALE_CHECKS) {
          await db.activation.update({
            where: {},
            data: { staleCheckCount: newStaleCount },
          });
          return NextResponse.json({
            activated: false,
            tampered: true,
            expiresAt: expiresAt.toISOString(),
            message: "Manipulation de l'horloge systeme detectee.",
          });
        }
        await db.activation.update({
          where: {},
          data: { staleCheckCount: newStaleCount },
        });
        return NextResponse.json({ activated: true, expiresAt: expiresAt.toISOString() });
      }

      // Time advanced normally
      await db.activation.update({
        where: {},
        data: {
          lastCheckedAt: new Date(nowMs).toISOString(),
          staleCheckCount: 0,
        },
      });
    } else {
      await db.activation.update({
        where: {},
        data: {
          lastCheckedAt: new Date(nowMs).toISOString(),
          staleCheckCount: 0,
        },
      });
    }

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
