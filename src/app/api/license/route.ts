import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMachineCode } from '@/lib/machine-id';

/**
 * GET /api/license
 * Check the current activation status of this machine.
 * Returns the machine code and whether the license is active, expired, or absent.
 */
export async function GET() {
  try {
    const machineCode = getMachineCode();

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
  } catch (error) {
    console.error('Failed to check license status:', error);
    return NextResponse.json(
      { error: 'Failed to check license status' },
      { status: 500 }
    );
  }
}
