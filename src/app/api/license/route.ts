import { NextResponse } from 'next/server';
import { getMachineCode } from '@/lib/machine-id';
import { readActivationFile, writeActivationFile } from '@/lib/activation-file';

// Maximum times the app can be opened with the same/similar time before blocking
const MAX_STALE_CHECKS = 3;

// Clock tolerance: 2 minutes (handles NTP sync, sleep/wake)
const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;

interface ActivationData {
  activationCode?: string;
  machineCode?: string;
  machineHash?: string;
  durationCode?: string;
  durationLabel?: string;
  expiryDate?: string;
  activatedAt?: string;
  expiresAt?: string;
  lastCheckedAt?: string | null;
  staleCheckCount?: number;
}

/**
 * GET /api/license
 * Check the current activation status of this machine.
 * 
 * Checks JSON file FIRST (most reliable in Electron), then DB.
 * 
 * ANTI-TAMPERING (3 layers):
 * Layer 1: Expiry check
 * Layer 2: Backward clock detection
 * Layer 3: Stuck clock detection
 */
export async function GET() {
  // Step 1: Get machine code
  let machineCode = '????-????-????-????';
  try {
    machineCode = getMachineCode();
  } catch (e) {
    console.error('[/api/license] getMachineCode failed:', e);
  }

  // Step 2: Read activation from JSON file (primary, reliable)
  let activation: ActivationData | null = readActivationFile();

  // Step 3: If not in JSON file, try database
  if (!activation) {
    try {
      const { db } = await import('@/lib/db');
      activation = await db.activation.findFirst();
    } catch (e) {
      console.log('[/api/license] DB not available, using JSON file only');
    }
  }

  // No activation record found
  if (!activation) {
    return NextResponse.json({ activated: false, machineCode });
  }

  const expiresAt = new Date(activation.expiresAt || activation.expiryDate || '');
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  // ========== LAYER 1: Expiry check ==========
  if (expiresAt < now) {
    return NextResponse.json({
      activated: false,
      machineCode,
      reason: 'expired' as const,
      expiryDate: activation.expiryDate,
    });
  }

  // ========== LAYER 2 & 3: Anti-clock-tampering ==========
  const nowMs = Date.now();
  const staleCount = activation.staleCheckCount || 0;

  if (activation.lastCheckedAt) {
    const lastCheckedMs = new Date(activation.lastCheckedAt).getTime();

    // ---- LAYER 2: Backward clock detection ----
    if (nowMs < lastCheckedMs - CLOCK_TOLERANCE_MS) {
      console.warn(
        `[SECURITY] Clock tampering detected! ` +
        `Now: ${new Date(nowMs).toISOString()}, ` +
        `LastCheck: ${activation.lastCheckedAt}, ` +
        `Diff: ${Math.round((lastCheckedMs - nowMs) / 60000)} minutes back`
      );

      activation.staleCheckCount = staleCount + 1;
      writeActivationFile(activation as any);

      // Also try DB update
      try {
        const { db } = await import('@/lib/db');
        await db.activation.update({ where: {}, data: { staleCheckCount: staleCount + 1 } });
      } catch { /* ignore */ }

      return NextResponse.json({
        activated: false,
        machineCode,
        reason: 'tampered' as const,
        expiryDate: activation.expiryDate,
        message: "Manipulation de l'horloge systeme detectee. Veuillez contacter l'administrateur.",
      });
    }

    // ---- LAYER 3: Stuck clock detection ----
    if (nowMs <= lastCheckedMs + CLOCK_TOLERANCE_MS) {
      const newStaleCount = staleCount + 1;

      if (newStaleCount >= MAX_STALE_CHECKS) {
        console.warn(
          `[SECURITY] Stuck clock detected! ` +
          `App opened ${newStaleCount} times without time advancing.`
        );

        activation.staleCheckCount = newStaleCount;
        writeActivationFile(activation as any);

        try {
          const { db } = await import('@/lib/db');
          await db.activation.update({ where: {}, data: { staleCheckCount: newStaleCount } });
        } catch { /* ignore */ }

        return NextResponse.json({
          activated: false,
          machineCode,
          reason: 'tampered' as const,
          expiryDate: activation.expiryDate,
          message: "Manipulation de l'horloge systeme detectee. Veuillez contacter l'administrateur.",
        });
      }

      activation.staleCheckCount = newStaleCount;
      writeActivationFile(activation as any);

      return NextResponse.json({
        activated: true,
        machineCode,
        expiryDate: activation.expiryDate,
        durationLabel: activation.durationLabel,
        staleWarning: newStaleCount >= MAX_STALE_CHECKS - 1,
      });
    }

    // ---- Time has advanced normally ----
    activation.lastCheckedAt = new Date(nowMs).toISOString();
    activation.staleCheckCount = 0;
    writeActivationFile(activation as any);

    try {
      const { db } = await import('@/lib/db');
      await db.activation.update({
        where: {},
        data: {
          lastCheckedAt: new Date(nowMs).toISOString(),
          staleCheckCount: 0,
        },
      });
    } catch { /* ignore */ }
  } else {
    // First check after activation
    activation.lastCheckedAt = new Date(nowMs).toISOString();
    activation.staleCheckCount = 0;
    writeActivationFile(activation as any);

    try {
      const { db } = await import('@/lib/db');
      await db.activation.update({
        where: {},
        data: {
          lastCheckedAt: new Date(nowMs).toISOString(),
          staleCheckCount: 0,
        },
      });
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    activated: true,
    machineCode,
    expiryDate: activation.expiryDate,
    durationLabel: activation.durationLabel,
  });
}
