import { NextResponse } from 'next/server';
import { getMachineCode } from '@/lib/machine-id';

export async function GET() {
  try {
    // Only available in local mode
    if (process.env.STORAGE_MODE !== 'local') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    const machineCode = getMachineCode();

    return NextResponse.json({ machineCode });
  } catch (error) {
    console.error('Failed to get machine code:', error);
    return NextResponse.json(
      { error: 'Failed to get machine code' },
      { status: 500 }
    );
  }
}
