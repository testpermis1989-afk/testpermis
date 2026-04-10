import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { encryptBuffer, isEncryptionEnabled } from '@/lib/file-encryption';

// POST /api/upload/photo - Upload user photo locally (encrypted)
// Saves encrypted photo in data/photos/ and returns a serve URL
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

    // Generate unique filename based on CIN
    const safeCin = (cin || 'user').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const ext = file.type === 'image/png' ? '.png' : '.jpg';
    const fileName = `${safeCin}${ext}`;

    // If encryption is enabled, save as encrypted .enc file
    // Otherwise save as plain image
    if (isEncryptionEnabled()) {
      const encrypted = encryptBuffer(buffer, ext);
      fs.writeFileSync(path.join(photosDir, fileName + '.enc'), encrypted);
    } else {
      fs.writeFileSync(path.join(photosDir, fileName), buffer);
    }

    // Return a serve URL that will decrypt on-the-fly
    const photoUrl = `/api/serve/photo/${safeCin}`;

    return NextResponse.json({ photo: photoUrl });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload de la photo" },
      { status: 500 }
    );
  }
}
