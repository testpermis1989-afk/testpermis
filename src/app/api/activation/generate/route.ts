import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  generateActivationCode,
  LICENSE_DURATIONS,
  getDurationLabel,
} from '@/lib/activation';

export async function POST(request: Request) {
  try {
    // Only available in local mode
    if (process.env.STORAGE_MODE !== 'local') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    const body = await request.json();
    const { machineCode, durationDays, clientName } = body;

    // Validate machine code
    if (!machineCode || typeof machineCode !== 'string') {
      return NextResponse.json(
        { error: 'Machine code is required' },
        { status: 400 }
      );
    }

    // Validate duration
    const validDurations = LICENSE_DURATIONS.map((d) => d.days);
    if (!durationDays || !validDurations.includes(durationDays)) {
      return NextResponse.json(
        {
          error: `Invalid duration. Must be one of: ${validDurations.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Generate the activation code
    const activationCode = generateActivationCode(machineCode, durationDays);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // Save to License table
    const license = await db.license.create({
      data: {
        machineCode,
        activationCode,
        durationDays,
        durationLabel: getDurationLabel(durationDays),
        clientName: clientName || null,
        expiresAt,
        createdAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      activationCode,
      license: {
        id: license.id,
        machineCode: license.machineCode,
        durationDays: license.durationDays,
        durationLabel: license.durationLabel,
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
