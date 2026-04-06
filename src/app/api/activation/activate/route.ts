import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getMachineId } from '@/lib/machine-id';
import { verifyActivationCode } from '@/lib/activation';

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

    // Get the current machine ID
    const machineCode = getMachineId();

    // Verify the activation code against this machine
    const result = verifyActivationCode(code, machineCode);

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Invalid activation code' },
        { status: 400 }
      );
    }

    // Upsert the activation record
    // First, delete any existing activation
    try {
      const existing = await db.activation.findFirst();
      if (existing) {
        await db.activation.delete({ where: { id: existing.id } });
      }
    } catch {
      // No existing record, continue
    }

    // Create the new activation record
    await db.activation.create({
      data: {
        machineCode,
        activationCode: code,
        durationDays: result.durationDays,
        expiresAt: result.expiresAt,
        activatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Activation successful',
      expiresAt: result.expiresAt!.toISOString(),
    });
  } catch (error) {
    console.error('Activation failed:', error);
    return NextResponse.json(
      { error: 'Activation failed' },
      { status: 500 }
    );
  }
}
