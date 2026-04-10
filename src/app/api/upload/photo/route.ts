import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// POST /api/upload/photo - Upload user photo locally
// Saves the photo as a file in data/photos/ and returns a base64 data URL
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cin = formData.get('cin') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Fichier photo requis' }, { status: 400 });
    }

    // Read file as buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Le fichier doit être une image' }, { status: 400 });
    }

    // Limit size to 500KB
    if (buffer.length > 500 * 1024) {
      return NextResponse.json({ error: 'Image trop volumineuse (max 500KB)' }, { status: 400 });
    }

    // Save photo locally in data/photos/
    const dataDir = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
    const photosDir = path.join(dataDir, 'photos');

    // Ensure directory exists
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }

    // Generate unique filename based on CIN or random
    const safeCin = (cin || 'user').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const ext = file.type === 'image/png' ? '.png' : '.jpg';
    const fileName = `${safeCin}${ext}`;
    const filePath = path.join(photosDir, fileName);

    // Write file
    fs.writeFileSync(filePath, buffer);

    // Return the photo as a base64 data URL (stored directly in DB)
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const photoDataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ photo: photoDataUrl });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload de la photo" },
      { status: 500 }
    );
  }
}
