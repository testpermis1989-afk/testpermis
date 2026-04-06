import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMachineHash } from '@/lib/machine-id';
import { validateActivationCode } from '@/lib/license-crypto';

/**
 * POST /api/license/activate
 * Validate an activation code against this machine and store the activation.
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

    // Get the raw machine hash for validation
    const machineHash = getMachineHash();

    // Validate the activation code against this machine
    const result = validateActivationCode(activationCode, machineHash);

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Invalid activation code' },
        { status: 400 }
      );
    }

    // Clear any previous activation (single-device, single-license model)
    await db.activation.deleteMany();

    // Store the new activation record
    await db.activation.create({
      data: {
        activationCode,
        machineCode: activationCode.replace(/-/g, '').substring(0, 8).toUpperCase(),
        machineHash,
        durationCode: result.durationCode || '',
        durationLabel: result.durationLabel || '',
        expiryDate: result.expiryDate || '',
        activatedAt: new Date().toISOString(),
        expiresAt: result.expiryDate || '',
      },
    });

    return NextResponse.json({
      success: true,
      expiryDate: result.expiryDate,
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
