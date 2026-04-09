// Activation system - generates and verifies license codes
// Duration and date are HIDDEN inside the hash - client cannot see or modify them
// Code format: XXXX-XXXX-XXXX-XXXX (16 chars, reveals nothing about duration or expiry)
import crypto from 'crypto';

const SECRET = 'PERMIS_MAROC_2025_SECRET_KEY';

// Duration codes - order must match exactly with activation-tool/main.js
const DURATIONS: Record<string, number> = {
  '2d': 2,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6mo': 180,
  '1yr': 365,
  'unlimited': 36500,
};

const DURATION_LABELS: Record<string, string> = {
  '2d': '2 jours',
  '7d': '7 jours',
  '30d': '30 jours',
  '90d': '90 jours',
  '6mo': '6 mois',
  '1yr': '1 an',
  'unlimited': 'Illimitee',
};

// Duration options for admin panel UI
export const LICENSE_DURATIONS = [
  { days: 2, code: '2d', label: '2 jours' },
  { days: 7, code: '7d', label: '7 jours' },
  { days: 30, code: '30d', label: '30 jours' },
  { days: 90, code: '90d', label: '90 jours' },
  { days: 180, code: '6mo', label: '6 mois' },
  { days: 365, code: '1yr', label: '1 an' },
  { days: 36500, code: 'unlimited', label: 'Illimitee' },
] as const;

/**
 * Generate an activation code for a specific machine
 * Duration and expiry date are HIDDEN inside the code - client cannot see them
 * Code format: XXXX-XXXX-XXXX-XXXX
 */
export function generateActivationCode(machineCode: string, durationCode: string): {
  code: string;
  durationLabel: string;
  expiryDate: string;
  durationDays: number;
} {
  const days = DURATIONS[durationCode] || 30;
  const label = DURATION_LABELS[durationCode] || '30 jours';

  const now = new Date();
  const expiryDate = durationCode === 'unlimited'
    ? '2099-12-31'
    : new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Day number since epoch (compact, deterministic)
  const genDay = Math.floor(now.getTime() / 86400000);
  // Duration index: 0=30d, 1=90d, 2=6mo, 3=1yr, 4=unlimited
  const durIndex = Object.keys(DURATIONS).indexOf(durationCode);
  // Pack genDay and durIndex into one number
  const infoNum = genDay * 10 + durIndex;

  // Hash includes machineCode + packed info + secret
  const payload = `${machineCode}|${infoNum}|${SECRET}`;
  const hash = crypto.createHash('sha256').update(payload).digest('hex');

  // First 8 chars = verification signature (visible)
  const sig = hash.substring(0, 8).toUpperCase();
  // Next 8 chars = hash used to XOR-encode the info number (hidden)
  const key = hash.substring(8, 16);

  // XOR-encode infoNum into 8 hex chars using key bytes
  const infoStr = infoNum.toString(16).padStart(8, '0');
  let encoded = '';
  for (let i = 0; i < 8; i++) {
    const c = parseInt(infoStr[i], 16) ^ parseInt(key[i], 16);
    encoded += c.toString(16).toUpperCase();
  }

  // Code = SIGSIG-ENCODED1-ENCODED2
  const code = `${sig.slice(0, 4)}-${sig.slice(4, 8)}-${encoded.slice(0, 4)}-${encoded.slice(4, 8)}`;
  return { code, durationLabel: label, expiryDate, durationDays: days };
}

/**
 * Verify an activation code against a machine code
 * The code reveals nothing about duration or expiry - all info is hidden
 * Uses the same algorithm as the standalone activation tool
 */
export function verifyActivationCode(
  code: string,
  machineCode: string
): { valid: boolean; expiresAt?: Date; durationDays?: number; durationLabel?: string; error?: string } {
  try {
    const parts = code.replace(/[-\s]/g, '').toUpperCase();
    if (parts.length !== 16) {
      return { valid: false, error: 'Format de code invalide' };
    }

    const sigPart = parts.substring(0, 8);
    const encodedPart = parts.substring(8, 16);

    const today = Math.floor(Date.now() / 86400000);
    const durKeys = Object.keys(DURATIONS);

    // Try each duration (5 options) and each generation day (up to 365 back)
    for (let durIndex = 0; durIndex < durKeys.length; durIndex++) {
      for (let daysBack = 0; daysBack <= 365; daysBack++) {
        const genDay = today - daysBack;
        const infoNum = genDay * 10 + durIndex;

        const payload = `${machineCode}|${infoNum}|${SECRET}`;
        const hash = crypto.createHash('sha256').update(payload).digest('hex');
        const expectedSig = hash.substring(0, 8).toUpperCase();

        // Quick check: signature must match first 8 chars
        if (expectedSig !== sigPart) continue;

        // Signature matches! Verify the encoded part with XOR key
        const key = hash.substring(8, 16);
        let decoded = '';
        for (let i = 0; i < 8; i++) {
          const c = parseInt(encodedPart[i], 16) ^ parseInt(key[i], 16);
          decoded += c.toString(16);
        }

        if (parseInt(decoded, 16) === infoNum) {
          // Code is valid! Extract duration and check expiry
          const durationCode = durKeys[durIndex];
          const days = DURATIONS[durationCode];
          const expiryDate = durationCode === 'unlimited'
            ? '2099-12-31'
            : new Date((genDay + days) * 86400000).toISOString().split('T')[0];

          if (durationCode !== 'unlimited' && new Date(expiryDate) < new Date()) {
            return { valid: false, error: 'Code expire' };
          }
          return {
            valid: true,
            expiresAt: new Date(expiryDate),
            durationDays: days,
            durationLabel: DURATION_LABELS[durationCode],
          };
        }
      }
    }

    return { valid: false, error: 'Code invalide pour cet ordinateur' };
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

/**
 * Get duration code from days
 */
export function getDurationCode(days: number): string {
  const found = LICENSE_DURATIONS.find(d => d.days === days);
  return found ? found.code : '30d';
}
