import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
const LOCAL_TEMP_DIR = path.join(LOCAL_DATA_DIR, 'temp-uploads');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importId = formData.get('importId') as string;
    const categoryCode = formData.get('categoryCode') as string;
    const serieNumber = formData.get('serieNumber') as string;

    if (!file || !importId) {
      return NextResponse.json({ error: 'Missing file or importId' }, { status: 400 });
    }

    // Ensure temp directory exists
    if (!fs.existsSync(LOCAL_TEMP_DIR)) {
      fs.mkdirSync(LOCAL_TEMP_DIR, { recursive: true });
    }

    // Save ZIP file
    const buffer = Buffer.from(await file.arrayBuffer());
    const zipPath = path.join(LOCAL_TEMP_DIR, `${importId}.zip`);
    fs.writeFileSync(zipPath, buffer);

    // Save metadata
    const metadata = JSON.stringify({
      categoryCode,
      serieNumber,
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      verified: false,
      createdAt: Date.now(),
    });
    fs.writeFileSync(path.join(LOCAL_TEMP_DIR, `${importId}.json`), metadata);

    return NextResponse.json({ success: true, importId });
  } catch (error) {
    console.error('Temp upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
