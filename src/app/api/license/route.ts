import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMachineCode } from '@/lib/machine-id';

// Maximum times the app can be opened with the same/similar time before blocking
// This prevents the attack: set clock to Jan 15, open app every day
const MAX_STALE_CHECKS = 3;

// Clock tolerance: 2 minutes (handles NTP sync, sleep/wake)
const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;

/**
 * GET /api/license
 * Check the current activation status of this machine.
 * 
 * ANTI-TAMPERING (3 layers):
 * 
 * Layer 1: Expiry check
 *   - Compare system date against stored expiry date
 * 
 * Layer 2: Backward clock detection
 *   - If current time < lastCheckedAt - tolerance → clock was turned BACK
 *   - Block immediately (prevent "change date to yesterday" attack)
 * 
 * Layer 3: Stuck clock detection
 *   - If the clock hasn't advanced past lastCheckedAt for N consecutive checks
 *   - Block (prevent "set clock to Jan 15 every day" attack)
 *   - lastCheckedAt acts as a HIGH WATER MARK — never decreases
 */
export async function GET() {
  // Step 1: Get machine code (may fail in some environments)
  let machineCode = '????-????-????-????';
  try {
    machineCode = getMachineCode();
  } catch (e) {
    console.error('[/api/license] getMachineCode failed:', e);
  }

  // Step 2: Check activation from DB
  try {
    const activation = await db.activation.findFirst();

    // No activation record found
    if (!activation) {
      return NextResponse.json({ activated: false, machineCode });
    }

    const expiresAt = new Date(activation.expiresAt);
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
      // If current time is significantly BEFORE the last check,
      // the user turned back their system clock
      if (nowMs < lastCheckedMs - CLOCK_TOLERANCE_MS) {
        console.warn(
          `[SECURITY] Clock tampering detected! ` +
          `Now: ${new Date(nowMs).toISOString()}, ` +
          `LastCheck: ${activation.lastCheckedAt}, ` +
          `Diff: ${Math.round((lastCheckedMs - nowMs) / 60000)} minutes back`
        );

        // Update staleCheckCount (increment but don't update lastCheckedAt)
        await db.activation.update({
          where: {},
          data: {
            staleCheckCount: staleCount + 1,
          },
        });

        return NextResponse.json({
          activated: false,
          machineCode,
          reason: 'tampered' as const,
          expiryDate: activation.expiryDate,
          message: "Manipulation de l'horloge systeme detectee. Veuillez contacter l'administrateur.",
        });
      }

      // ---- LAYER 3: Stuck clock detection ----
      // If current time hasn't advanced PAST lastCheckedAt,
      // the user is keeping the clock at the same date/time
      if (nowMs <= lastCheckedMs + CLOCK_TOLERANCE_MS) {
        // Clock is stuck (hasn't advanced)
        const newStaleCount = staleCount + 1;

        console.log(
          `[LICENSE] Clock hasn't advanced. ` +
          `Stale count: ${newStaleCount}/${MAX_STALE_CHECKS}, ` +
          `Now: ${new Date(nowMs).toISOString()}, ` +
          `LastCheck: ${activation.lastCheckedAt}`
        );

        // Block after MAX_STALE_CHECKS consecutive stale checks
        if (newStaleCount >= MAX_STALE_CHECKS) {
          console.warn(
            `[SECURITY] Stuck clock detected! ` +
            `App opened ${newStaleCount} times without time advancing.`
          );

          // Don't update lastCheckedAt — keep it as the high water mark
          await db.activation.update({
            where: {},
            data: { staleCheckCount: newStaleCount },
          });

          return NextResponse.json({
            activated: false,
            machineCode,
            reason: 'tampered' as const,
            expiryDate: activation.expiryDate,
            message: "Manipulation de l'horloge systeme detectee. Veuillez contacter l'administrateur.",
          });
        }

        // Not yet blocked, but increment counter (DON'T update lastCheckedAt)
        await db.activation.update({
          where: {},
          data: { staleCheckCount: newStaleCount },
        });

        // Allow this check but warn is approaching
        return NextResponse.json({
          activated: true,
          machineCode,
          expiryDate: activation.expiryDate,
          durationLabel: activation.durationLabel,
          staleWarning: newStaleCount >= MAX_STALE_CHECKS - 1,
        });
      }

      // ---- Time has advanced normally ----
      // Update lastCheckedAt to current time (HIGH WATER MARK)
      // Reset staleCheckCount to 0
      await db.activation.update({
        where: {},
        data: {
          lastCheckedAt: new Date(nowMs).toISOString(),
          staleCheckCount: 0,
        },
      });
    } else {
      // First check after activation (no lastCheckedAt yet)
      await db.activation.update({
        where: {},
        data: {
          lastCheckedAt: new Date(nowMs).toISOString(),
          staleCheckCount: 0,
        },
      });
    }

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
