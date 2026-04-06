// Activation system - generates and verifies license codes
// Uses SHA256 signature matching the standalone activation tool format
// Code format: SIGNATURE-DURATIONCODE-DATE (e.g. "8DA961AB-30D-260506")
import crypto from 'crypto';

const SECRET = 'PERMIS_MAROC_2025_SECRET_KEY';

// Duration codes matching the activation tool
const DURATIONS: Record<string, number> = {
  '30d': 30,
  '90d': 90,
  '6mo': 180,
  '1yr': 365,
  'unlimited': 36500,
};

const DURATION_LABELS: Record<string, string> = {
  '30d': '30 jours',
  '90d': '90 jours',
  '6mo': '6 mois',
  '1yr': '1 an',
  'unlimited': 'Illimitee',
};

// Supported durations for admin panel
export const LICENSE_DURATIONS = [
  { days: 30, code: '30d', label: '30 jours' },
  { days: 90, code: '90d', label: '90 jours' },
  { days: 180, code: '6mo', label: '6 mois' },
  { days: 365, code: '1yr', label: '1 an' },
  { days: 36500, code: 'unlimited', label: 'Illimitee' },
] as const;

/**
 * Generate an activation code for a specific machine
 * Format: SIGNATURE-DURATIONCODE-DATE (e.g. "8DA961AB-30D-260506")
 * This matches the standalone activation tool format
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

  const payload = `${machineCode}|${durationCode}|${expiryDate}|${SECRET}`;
  const signature = crypto.createHash('sha256').update(payload).digest('hex').substring(0, 8).toUpperCase();

  const code = `${signature}-${durationCode.toUpperCase()}-${expiryDate.replace(/-/g, '').substring(2)}`;
  return { code, durationLabel: label, expiryDate, durationDays: days };
}

/**
 * Verify an activation code against a machine code
 * Must match the same format as the activation tool
 */
export function verifyActivationCode(
  code: string,
  machineCode: string
): { valid: boolean; expiresAt?: Date; durationDays?: number; durationLabel?: string; error?: string } {
  try {
    const parts = code.split('-');
    if (parts.length < 3) {
      return { valid: false, error: 'Format de code invalide' };
    }

    // Extract duration code from parts[1]
    const durationCode = parts[1].toLowerCase();
    if (!DURATIONS[durationCode]) {
      return { valid: false, error: 'Code invalide' };
    }

    // Regenerate expected code using this machine's code
    const expected = generateActivationCode(machineCode, durationCode);

    if (expected.code === code) {
      // Check expiry
      if (durationCode !== 'unlimited' && new Date(expected.expiryDate) < new Date()) {
        return { valid: false, error: 'Code expire' };
      }
      return {
        valid: true,
        expiresAt: new Date(expected.expiryDate),
        durationDays: expected.durationDays,
        durationLabel: expected.durationLabel,
      };
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
