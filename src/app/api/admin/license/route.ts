import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  generateActivationCode,
  DURATION_OPTIONS,
  type LicenseDuration,
} from '@/lib/license-crypto';

/**
 * GET /api/admin/license
 * List all generated licenses.
 */
export async function GET() {
  try {
    const licenses = await db.license.findMany();
    return NextResponse.json({ licenses });
  } catch (error) {
    console.error('Failed to list licenses:', error);
    return NextResponse.json(
      { error: 'Failed to list licenses' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/license
 * Generate a new activation code for a given machine code and duration.
 *
 * Body: { machineCode: string, duration: string, clientName?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machineCode, duration, clientName } = body;

    // Validate machine code
    if (!machineCode || typeof machineCode !== 'string') {
      return NextResponse.json(
        { error: 'Machine code is required' },
        { status: 400 }
      );
    }

    // Validate duration
    if (!duration || typeof duration !== 'string') {
      return NextResponse.json(
        { error: 'Duration is required' },
        { status: 400 }
      );
    }

    const durationOption = DURATION_OPTIONS.find(
      (d) => d.value === duration
    );
    if (!durationOption) {
      return NextResponse.json(
        {
          error: `Invalid duration. Must be one of: ${DURATION_OPTIONS.map((d) => d.value).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Generate the activation code
    const result = generateActivationCode(
      machineCode,
      duration as LicenseDuration
    );

    // Persist the license record in the database
    await db.license.create({
      data: {
        machineCode,
        activationCode: result.code,
        clientName: clientName || null,
        durationCode: duration,
        durationLabel: result.durationLabel,
        durationDays: durationOption.days,
        expiryDate: result.expiryDate,
      },
    });

    return NextResponse.json({
      success: true,
      code: result.code,
      expiryDate: result.expiryDate,
      durationLabel: result.durationLabel,
    });
  } catch (error) {
    console.error('License generation failed:', error);
    return NextResponse.json(
      { error: 'License generation failed' },
      { status: 500 }
    );
  }
}
