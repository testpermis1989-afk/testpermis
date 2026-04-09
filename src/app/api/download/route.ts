import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'TestPermis_Desktop.zip');
  
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  
  const fileBuffer = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);
  
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="TestPermis_Desktop.zip"',
      'Content-Length': stats.size.toString(),
    },
  });
}
