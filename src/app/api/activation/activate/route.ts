import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMachineCode, getMachineHash } from '@/lib/machine-id';
import { verifyActivationCode, getDurationLabel } from '@/lib/activation';

export async function POST(request: Request) {
  try {
    // Only available in local mode
    if (process.env.STORAGE_MODE !== 'local') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Activation code is required' },
        { status: 400 }
      );
    }

    // Get the current machine info
    const machineCode = getMachineCode();
    const machineHash = getMachineHash();

    // Verify the activation code against this machine
    const result = verifyActivationCode(code, machineCode);

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Invalid activation code' },
        { status: 400 }
      );
    }

    const durationDays = result.durationDays || 30;
    const expiryDate = result.expiresAt!.toISOString();

    // Upsert the activation record
    // First, delete any existing activation
    try {
      const existing = await db.activation.findFirst();
      if (existing) {
        await db.activation.deleteMany();
      }
    } catch {
      // No existing record, continue
    }

    // Create the new activation record
    await db.activation.create({
      data: {
        machineCode,
        machineHash,
        activationCode: code,
        durationCode: String(durationDays),
        durationLabel: getDurationLabel(durationDays),
        expiryDate,
        activatedAt: new Date().toISOString(),
        expiresAt: expiryDate,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Activation successful',
      expiryDate,
      durationLabel: getDurationLabel(durationDays),
    });
  } catch (error) {
    console.error('Activation failed:', error);
    return NextResponse.json(
      { error: 'Activation failed' },
      { status: 500 }
    );
  }
}
