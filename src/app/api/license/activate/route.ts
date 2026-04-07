import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMachineCode, getMachineHash } from '@/lib/machine-id';
import { verifyActivationCode } from '@/lib/activation';

/**
 * POST /api/license/activate
 * Validate an activation code against this machine and store the activation.
 * Uses the same format as the standalone activation tool.
 *
 * Body: { activationCode: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activationCode } = body;

    if (!activationCode || typeof activationCode !== 'string') {
      return NextResponse.json(
        { error: 'Activation code is required' },
        { status: 400 }
      );
    }

    // Get the machine code for validation
    const machineCode = getMachineCode();
    const machineHash = getMachineHash();

    // Validate the activation code against this machine (same format as activation tool)
    const result = verifyActivationCode(activationCode, machineCode);

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Code invalide' },
        { status: 400 }
      );
    }

    const expiryDate = result.expiresAt!.toISOString();
    const nowISO = new Date().toISOString();

    // Clear any previous activation
    try {
      await db.activation.deleteMany();
    } catch {
      // Table may not exist yet
    }

    // Store the new activation record with lastCheckedAt
    await db.activation.create({
      data: {
        activationCode,
        machineCode,
        machineHash,
        durationCode: String(result.durationDays || 30),
        durationLabel: result.durationLabel || '',
        expiryDate,
        activatedAt: nowISO,
        expiresAt: expiryDate,
        lastCheckedAt: nowISO,
      },
    });

    return NextResponse.json({
      success: true,
      expiryDate,
      durationLabel: result.durationLabel,
    });
  } catch (error) {
    console.error('Activation failed:', error);
    return NextResponse.json(
      { error: 'Activation failed' },
      { status: 500 }
    );
  }
}
