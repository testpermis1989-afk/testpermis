import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateActivationCode, LICENSE_DURATIONS } from '@/lib/activation';

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
 * Uses the same format as the standalone activation tool.
 *
 * Body: { machineCode: string, duration: string, clientName?: string }
 * duration values: "30d", "90d", "6mo", "1yr", "unlimited"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machineCode, duration, clientName } = body;

    if (!machineCode || typeof machineCode !== 'string') {
      return NextResponse.json(
        { error: 'Machine code is required' },
        { status: 400 }
      );
    }

    // Validate duration code
    const validCodes = LICENSE_DURATIONS.map((d) => d.code);
    if (!duration || !validCodes.includes(duration)) {
      return NextResponse.json(
        { error: `Invalid duration. Must be one of: ${validCodes.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate the activation code (same format as activation tool)
    const result = generateActivationCode(machineCode, duration);

    // Persist the license record
    await db.license.create({
      data: {
        machineCode,
        activationCode: result.code,
        clientName: clientName || null,
        durationCode: duration,
        durationLabel: result.durationLabel,
        durationDays: result.durationDays,
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
