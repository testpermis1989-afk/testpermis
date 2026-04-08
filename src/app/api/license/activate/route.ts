import { NextRequest, NextResponse } from 'next/server';
import { getMachineCode, getMachineHash } from '@/lib/machine-id';
import { verifyActivationCode } from '@/lib/activation';
import { readActivationFile, writeActivationFile, deleteActivationFile } from '@/lib/activation-file';

/**
 * POST /api/license/activate
 * Validate an activation code against this machine and store the activation.
 * Uses the same format as the standalone activation tool.
 *
 * IMPORTANT: This endpoint works WITHOUT a database.
 * Activation is stored in a JSON file as fallback (same as activation-tool).
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

    // Get the machine code for validation (uses os module, works in Electron)
    const machineCode = getMachineCode();
    const machineHash = getMachineHash();

    // Validate the activation code against this machine (pure computation, no DB needed)
    const result = verifyActivationCode(activationCode, machineCode);

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Code invalide' },
        { status: 400 }
      );
    }

    const expiryDate = result.expiresAt!.toISOString();
    const nowISO = new Date().toISOString();

    // Store activation in JSON file (reliable, no dependencies)
    const record = {
      activationCode,
      machineCode,
      machineHash,
      durationCode: String(result.durationDays || 30),
      durationLabel: result.durationLabel || '',
      expiryDate,
      activatedAt: nowISO,
      expiresAt: expiryDate,
      lastCheckedAt: nowISO,
      staleCheckCount: 0,
    };
    writeActivationFile(record);

    // Also try to store in database (for consistency with other features)
    try {
      const { db } = await import('@/lib/db');
      await db.activation.deleteMany();
      await db.activation.create({ data: record });
    } catch (dbErr) {
      console.log('[/api/license/activate] DB save failed (using JSON file):', dbErr);
    }

    return NextResponse.json({
      success: true,
      expiryDate,
      durationLabel: result.durationLabel,
    });
  } catch (error) {
    console.error('Activation failed:', error);
    return NextResponse.json(
      { error: 'Activation failed: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
