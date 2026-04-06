// Activation system - generates and verifies license codes
// Uses AES-256-CBC encryption to embed machine code + expiry in the activation code
// The secret key is derived from a passphrase using scrypt (KDF)
import crypto from 'crypto';

// Derive encryption key from passphrase (same across all app installations)
const SECRET_KEY = crypto.scryptSync(
  'PermisMaroc-LicenceSystem-2025-SecretKey',
  'ActivationSalt-Naoual',
  32
);

// Supported durations in days
export const LICENSE_DURATIONS = [
  { days: 30, label: '1 mois', labelAr: 'شهر واحد' },
  { days: 90, label: '3 mois', labelAr: '3 أشهر' },
  { days: 180, label: '6 mois', labelAr: '6 أشهر' },
  { days: 365, label: '1 an', labelAr: 'سنة واحدة' },
  { days: 730, label: '2 ans', labelAr: 'سنتان' },
] as const;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted: string): string | null {
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const data = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Generate an activation code for a specific machine
 * @param machineCode - The client's machine code (e.g., "A1B2-C3D4-E5F6-G7H8")
 * @param durationDays - License duration in days (30, 90, 180, 365, 730)
 * @returns Formatted activation code (e.g., "30-X9K2M4P7Q1R8T3V-5W6Y7Z8A0B1C2D4-E5F6")
 */
export function generateActivationCode(machineCode: string, durationDays: number): string {
  // Calculate expiry timestamp
  const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;

  // Create payload with machine code, expiry, and duration
  const payload = JSON.stringify({
    m: machineCode,
    e: expiresAt,
    d: durationDays,
  });

  // Encrypt the payload
  const encrypted = encrypt(payload);

  // Encode to base64url (URL-safe characters only)
  const encoded = Buffer.from(encrypted).toString('base64url').toUpperCase();

  // Prepend duration code (2 digits) for quick identification
  const durCode = String(durationDays).padStart(2, '0');

  // Full code: duration + encrypted payload
  const fullCode = durCode + encoded;

  // Format as groups of 5 characters for readability
  return fullCode.match(/.{1,5}/g).join('-');
}

/**
 * Verify an activation code against a machine code
 * @param code - The activation code entered by the user
 * @param machineCode - The current machine's code
 * @returns Verification result
 */
export function verifyActivationCode(
  code: string,
  machineCode: string
): { valid: boolean; expiresAt?: Date; durationDays?: number; error?: string } {
  try {
    // Clean the code (remove dashes and spaces)
    const cleaned = code.replace(/[-\s]/g, '');

    if (cleaned.length < 4) {
      return { valid: false, error: 'Code trop court' };
    }

    // Extract duration code (first 2 digits)
    const durCode = parseInt(cleaned.substring(0, 2));
    const payloadCode = cleaned.substring(2).toLowerCase();

    // Decode the payload
    const encrypted = Buffer.from(payloadCode, 'base64url').toString();
    const payload = decrypt(encrypted);

    if (!payload) {
      return { valid: false, error: 'Code invalide' };
    }

    const data = JSON.parse(payload);

    // Verify machine code matches
    if (data.m !== machineCode) {
      return { valid: false, error: 'Code invalide pour cet ordinateur' };
    }

    // Verify duration matches
    if (data.d !== durCode) {
      return { valid: false, error: 'Code invalide' };
    }

    // Check if expired
    if (Date.now() > data.e) {
      const expiredDate = new Date(data.e).toLocaleDateString('fr-FR');
      return { valid: false, error: `Licence expirée le ${expiredDate}` };
    }

    return {
      valid: true,
      expiresAt: new Date(data.e),
      durationDays: data.d,
    };
  } catch {
    return { valid: false, error: 'Code invalide' };
  }
}

/**
 * Get duration label from days
 */
export function getDurationLabel(days: number): string {
  const found = LICENSE_DURATIONS.find(d => d.days === days);
  return found ? found.label : `${days} jours`;
}
