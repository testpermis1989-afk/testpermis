import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMachineCode } from '@/lib/machine-id';

/**
 * GET /api/license
 * Check the current activation status of this machine.
 * Returns the machine code and whether the license is active, expired, or absent.
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
