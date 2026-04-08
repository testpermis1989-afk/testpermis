// Fallback activation storage using JSON file
// Used when the database (sql.js) is not available or fails
// Mirrors the same approach as the activation-tool for reliability

import fs from 'fs';
import path from 'path';

// Data directory - same as electron/main.js uses
function getDataDir(): string {
  return process.env.LOCAL_DATA_DIR || path.join(process.cwd(), 'data');
}

function getActivationFile(): string {
  return path.join(getDataDir(), 'activation.json');
}

interface ActivationRecord {
  activationCode: string;
  machineCode: string;
  machineHash: string;
  durationCode: string;
  durationLabel: string;
  expiryDate: string;
  activatedAt: string;
  expiresAt: string;
  lastCheckedAt?: string;
  staleCheckCount?: number;
}

function ensureDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readActivationFile(): ActivationRecord | null {
  try {
    const filePath = getActivationFile();
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function writeActivationFile(record: ActivationRecord): void {
  try {
    ensureDir();
    const filePath = getActivationFile();
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
  } catch (e) {
    console.error('[activation-file] Failed to write activation file:', e);
  }
}

export function deleteActivationFile(): void {
  try {
    const filePath = getActivationFile();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error('[activation-file] Failed to delete activation file:', e);
  }
}
