import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  generateActivationCode,
  LICENSE_DURATIONS,
  getDurationCode,
} from '@/lib/activation';

export async function POST(request: Request) {
  try {
    // Only available in local mode
    if (process.env.STORAGE_MODE !== 'local') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    const body = await request.json();
    const { machineCode, durationCode, clientName } = body;

    // Validate machine code
    if (!machineCode || typeof machineCode !== 'string') {
      return NextResponse.json(
        { error: 'Machine code is required' },
        { status: 400 }
      );
    }

    // Validate duration code
    const validCodes = LICENSE_DURATIONS.map((d) => d.code);
    if (!durationCode || !validCodes.includes(durationCode)) {
      return NextResponse.json(
        { error: `Invalid duration. Must be one of: ${validCodes.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate the activation code
    const result = generateActivationCode(machineCode, durationCode);

    // Save to License table
    const license = await db.license.create({
      data: {
        machineCode,
        activationCode: result.code,
        durationCode: result.durationLabel,
        durationLabel: result.durationLabel,
        clientName: clientName || null,
        expiresAt: new Date(result.expiryDate),
        createdAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      activationCode: result.code,
      durationLabel: result.durationLabel,
      expiryDate: result.expiryDate,
      license: {
        id: license.id,
        machineCode: license.machineCode,
        activationCode: result.code,
        durationLabel: result.durationLabel,
        clientName: license.clientName,
        expiresAt: license.expiresAt,
      },
    });
  } catch (error) {
    console.error('License generation failed:', error);
    return NextResponse.json(
      { error: 'License generation failed' },
      { status: 500 }
    );
  }
}
