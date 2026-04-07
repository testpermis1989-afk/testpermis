import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMachineCode } from '@/lib/machine-id';

/**
 * GET /api/license
 * Check the current activation status of this machine.
 * Returns the machine code and whether the license is active, expired, or absent.
 * 
 * ANTI-TAMPERING: Detects if the system clock has been turned back.
 * If lastCheckedAt exists and current time < lastCheckedAt - tolerance,
 * it means the user manipulated the clock to bypass expiry.
 */
export async function GET() {
  // Step 1: Get machine code (may fail in some environments)
  let machineCode = '????-????-????-????';
  try {
    machineCode = getMachineCode();
  } catch (e) {
    console.error('[/api/license] getMachineCode failed:', e);
  }

  // Step 2: Check activation from DB (may fail if DB not initialized yet)
  try {
    const activation = await db.activation.findFirst();

    // No activation record found
    if (!activation) {
      return NextResponse.json({ activated: false, machineCode });
    }

    const expiresAt = new Date(activation.expiresAt);
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    // Activation exists but has expired
    if (expiresAt < now) {
      return NextResponse.json({
        activated: false,
        machineCode,
        reason: 'expired' as const,
        expiryDate: activation.expiryDate,
      });
    }

    // ==========================================
    // ANTI-CLOCK-TAMPERING CHECK
    // ==========================================
    // Tolerance: 10 minutes (to handle NTP sync, sleep/wake, etc.)
    const CLOCK_TOLERANCE_MS = 10 * 60 * 1000;
    const nowMs = Date.now();

    if (activation.lastCheckedAt) {
      const lastCheckedMs = new Date(activation.lastCheckedAt).getTime();
      
      // If current time is significantly BEFORE the last check time,
      // the user has turned back their system clock
      if (nowMs < lastCheckedMs - CLOCK_TOLERANCE_MS) {
        console.warn(
          `[SECURITY] Clock tampering detected! ` +
          `Now: ${new Date(nowMs).toISOString()}, ` +
          `LastCheck: ${activation.lastCheckedAt}, ` +
          `Diff: ${Math.round((lastCheckedMs - nowMs) / 60000)} minutes`
        );
        
        // Update lastCheckedAt to prevent repeated warnings
        // (but still block access until proper reactivation)
        await db.activation.update({
          where: {},
          data: { lastCheckedAt: new Date(nowMs).toISOString() },
        });
        
        return NextResponse.json({
          activated: false,
          machineCode,
          reason: 'tampered' as const,
          expiryDate: activation.expiryDate,
          message: 'Manipulation de l\'horloge systeme detectee. Veuillez recontacter l\'administrateur.',
        });
      }
    }

    // ==========================================
    // License is valid - update lastCheckedAt
    // ==========================================
    await db.activation.update({
      where: {},
      data: { lastCheckedAt: new Date(nowMs).toISOString() },
    });

    // Activation is valid and not expired
    return NextResponse.json({
      activated: true,
      machineCode,
      expiryDate: activation.expiryDate,
      durationLabel: activation.durationLabel,
    });
  } catch (e) {
    // DB might not be initialized yet - just return machine code with not activated
    console.error('[/api/license] DB check failed (may be first run):', e);
    return NextResponse.json({ activated: false, machineCode });
  }
}
