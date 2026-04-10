import { NextRequest, NextResponse } from 'next/server';

// POST /api/upload/rar/compress - Compress files in temp upload before final import (cloud mode)
export async function POST(request: NextRequest) {
  try {
    const { importId } = await request.json();
    if (!importId) {
      return NextResponse.json({ error: 'importId requis' }, { status: 400 });
    }

    // In desktop mode, compression is done during import
    // This endpoint is mainly for cloud mode
    return NextResponse.json({
      totalBefore: 0,
      totalAfter: 0,
      totalSaved: 0,
      result: {
        images: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
        responses: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
        audio: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
        video: { compressed: 0, beforeBytes: 0, afterBytes: 0 },
      },
    });
  } catch (error) {
    console.error('[Upload/RAR/Compress] Error:', error);
    return NextResponse.json({ error: 'Erreur de compression: ' + (error as Error).message }, { status: 500 });
  }
}
