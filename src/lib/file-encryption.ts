/**
 * File Encryption Utility for Permis Maroc Desktop App
 * Encrypts/decrypts series files (images, audio, video) using AES-256-GCM
 * 
 * Key is derived from Machine ID (CPU, disk, etc.) so files can only be
 * decrypted on the same machine where they were imported.
 * 
 * Supports TWO encrypted file formats:
 * 
 *   NEW format (with PMENC magic header):
 *     [5 bytes: "PMENC"] [2 bytes: original ext length] [original ext] [IV: 12 bytes] [auth tag: 16 bytes] [encrypted data]
 * 
 *   OLD format (no magic header, for backward compatibility):
 *     [2 bytes: original ext length] [original ext] [IV: 12 bytes] [auth tag: 16 bytes] [encrypted data]
 * 
 * Encryption can be disabled via env var DISABLE_FILE_ENCRYPTION=true
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

// In-memory cache for decrypted content (avoid re-decrypting on every request)
const decryptCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_MAX_SIZE = 200; // max cached files
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

// Magic header for NEW format
const MAGIC_HEADER = Buffer.from('PMENC');
const MAGIC_HEADER_LENGTH = MAGIC_HEADER.length; // 5 bytes

// Cached encryption key (derived once per process)
let cachedKey: Buffer | null = null;

/**
 * Check if file encryption is enabled
 * Can be disabled via DISABLE_FILE_ENCRYPTION env var
 */
export function isEncryptionEnabled(): boolean {
  return process.env.DISABLE_FILE_ENCRYPTION !== 'true';
}

/**
 * Get a machine-specific identifier
 * Combines multiple hardware identifiers to create a unique machine fingerprint
 */
function getMachineId(): string {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  const cpus = os.cpus().map(c => c.model).join(',');
  const tmpdir = os.tmpdir();
  const homedir = os.homedir();
  
  const machineString = `permis-maroc:${platform}:${arch}:${hostname}:${tmpdir}:${homedir}:${cpus}`;
  
  return machineString;
}

/**
 * Derive AES-256 encryption key from machine ID
 * Uses PBKDF2 with a fixed salt for key derivation
 */
function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const machineId = getMachineId();
  const salt = 'PermisMaroc2024EncryptionSalt_v1';
  
  cachedKey = crypto.pbkdf2Sync(
    machineId,
    salt,
    100000, // iterations
    KEY_LENGTH,
    'sha256'
  );
  
  return cachedKey;
}

/**
 * Check if a buffer starts with the PMENC magic header
 */
export function hasPMENCHeader(data: Buffer): boolean {
  if (data.length < MAGIC_HEADER_LENGTH) return false;
  return data.subarray(0, MAGIC_HEADER_LENGTH).equals(MAGIC_HEADER);
}

/**
 * Encrypt a Buffer and return encrypted Buffer with PMENC header
 * 
 * Header format:
 *   [5 bytes: "PMENC"] [2 bytes: original extension length] [original extension bytes]
 *   [12 bytes: IV] [16 bytes: auth tag] [encrypted data]
 */
export function encryptBuffer(data: Buffer, originalExt: string): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  const extBuffer = Buffer.from(originalExt, 'utf-8');
  const extLength = Buffer.alloc(2);
  extLength.writeUInt16LE(extBuffer.length);
  
  // Combine: PMENC magic + extLength + ext + iv + authTag + encrypted
  return Buffer.concat([MAGIC_HEADER, extLength, extBuffer, iv, authTag, encrypted]);
}

/**
 * Decrypt a Buffer - supports BOTH old and new formats
 * 
 * Returns { data: Buffer; ext: string } or null if decryption fails
 */
export function decryptBuffer(encryptedData: Buffer): { data: Buffer; ext: string } | null {
  try {
    const key = getEncryptionKey();
    
    let offset = 0;
    let hasMagic = false;
    
    // Check if data has PMENC magic header (new format)
    if (hasPMENCHeader(encryptedData)) {
      hasMagic = true;
      offset = MAGIC_HEADER_LENGTH; // skip "PMENC"
    }
    // Otherwise assume OLD format (no magic header, starts directly with ext length)
    
    // Check minimum size: extLength(2) + IV(12) + authTag(16) = 30+
    if (encryptedData.length - offset < 2 + IV_LENGTH + AUTH_TAG_LENGTH) return null;
    
    // Read extension length (2 bytes)
    const extLength = encryptedData.readUInt16LE(offset);
    offset += 2;
    
    // Validate extension length
    if (extLength > 20 || offset + extLength + IV_LENGTH + AUTH_TAG_LENGTH > encryptedData.length) {
      return null;
    }
    
    // Read extension
    const ext = encryptedData.slice(offset, offset + extLength).toString('utf-8');
    offset += extLength;
    
    // Read IV
    const iv = encryptedData.slice(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;
    
    // Read auth tag
    const authTag = encryptedData.slice(offset, offset + AUTH_TAG_LENGTH);
    offset += AUTH_TAG_LENGTH;
    
    // Read encrypted data
    const encrypted = encryptedData.slice(offset);
    
    if (encrypted.length === 0) return null;
    
    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return { data: decrypted, ext };
  } catch (e) {
    // Decryption failed - likely wrong key or corrupted data
    return null;
  }
}

/**
 * Encrypt a file on disk
 * Reads file, encrypts content, saves with .enc extension
 * Original file is deleted after successful encryption
 */
export function encryptFile(filePath: string): boolean {
  if (!isEncryptionEnabled()) return false;
  
  try {
    if (!fs.existsSync(filePath)) return false;
    
    const ext = path.extname(filePath).toLowerCase();
    const fileData = fs.readFileSync(filePath);
    
    const encrypted = encryptBuffer(fileData, ext);
    
    const encPath = filePath + '.enc';
    fs.writeFileSync(encPath, encrypted);
    
    // Delete original
    try { fs.unlinkSync(filePath); } catch {}
    
    return true;
  } catch (e) {
    console.warn('[FileEncrypt] Failed to encrypt file:', filePath, (e as Error).message);
    return false;
  }
}

/**
 * Decrypt a .enc file and return the content + original extension
 * Uses in-memory cache for performance
 * Supports both PMENC (new) and legacy (old) encrypted formats
 */
export function decryptFileCached(encFilePath: string): { data: Buffer; ext: string } | null {
  // Check cache first
  const cacheKey = encFilePath;
  const cached = decryptCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return decryptBuffer(cached.buffer);
  }
  
  if (!fs.existsSync(encFilePath)) return null;
  
  try {
    const encryptedData = fs.readFileSync(encFilePath);
    const result = decryptBuffer(encryptedData);
    
    if (result) {
      // Update cache (evict old entries if cache is full)
      if (decryptCache.size >= CACHE_MAX_SIZE) {
        let oldest: string | null = null;
        let oldestTime = Infinity;
        for (const [key, val] of decryptCache) {
          if (val.timestamp < oldestTime) {
            oldestTime = val.timestamp;
            oldest = key;
          }
        }
        if (oldest) decryptCache.delete(oldest);
      }
      
      decryptCache.set(cacheKey, { buffer: encryptedData, timestamp: Date.now() });
    }
    
    return result;
  } catch {
    return null;
  }
}

/**
 * Check if a file is an encrypted .enc file
 */
export function isEncryptedFile(filePath: string): boolean {
  return filePath.endsWith('.enc');
}

/**
 * Encrypt all files in a directory recursively
 * Skips .enc files, .json files, .txt files
 * Can be disabled via DISABLE_FILE_ENCRYPTION env var
 */
export function encryptDirectory(dirPath: string): { encrypted: number; failed: number } {
  if (!isEncryptionEnabled()) {
    console.log('[FileEncrypt] Encryption disabled (DISABLE_FILE_ENCRYPTION=true), skipping:', dirPath);
    return { encrypted: 0, failed: 0 };
  }
  
  let encrypted = 0;
  let failed = 0;
  
  try {
    if (!fs.existsSync(dirPath)) return { encrypted: 0, failed: 0 };
    
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return { encrypted: 0, failed: 0 };
    
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const entryStat = fs.statSync(fullPath);
      
      if (entryStat.isDirectory()) {
        const subResult = encryptDirectory(fullPath);
        encrypted += subResult.encrypted;
        failed += subResult.failed;
      } else if (entryStat.isFile()) {
        const lowerName = entry.toLowerCase();
        if (lowerName.endsWith('.enc')) continue;
        if (lowerName.endsWith('.json')) continue;
        if (lowerName.endsWith('.txt')) continue;
        if (lowerName.endsWith('.db')) continue;
        if (lowerName.endsWith('.sqlite')) continue;
        
        const ext = path.extname(fullPath).toLowerCase();
        const mediaExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.mp3', '.mp4', '.wav', '.ogg', '.aac', '.webm'];
        if (!mediaExts.includes(ext)) continue;
        
        if (encryptFile(fullPath)) {
          encrypted++;
        } else {
          failed++;
        }
      }
    }
  } catch (e) {
    console.warn('[FileEncrypt] Error encrypting directory:', dirPath, (e as Error).message);
  }
  
  return { encrypted, failed };
}

/**
 * Decrypt all .enc files in a directory, replacing them with original files
 * Useful for migration or when encryption needs to be removed
 */
export function decryptDirectory(dirPath: string): { decrypted: number; failed: number } {
  let decrypted = 0;
  let failed = 0;
  
  try {
    if (!fs.existsSync(dirPath)) return { decrypted: 0, failed: 0 };
    
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return { decrypted: 0, failed: 0 };
    
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const entryStat = fs.statSync(fullPath);
      
      if (entryStat.isDirectory()) {
        const subResult = decryptDirectory(fullPath);
        decrypted += subResult.decrypted;
        failed += subResult.failed;
      } else if (entryStat.isFile() && entry.toLowerCase().endsWith('.enc')) {
        const result = decryptFileCached(fullPath);
        if (result) {
          // Restore original file
          const originalPath = fullPath.slice(0, -4); // remove .enc
          fs.writeFileSync(originalPath, result.data);
          // Remove .enc file
          try { fs.unlinkSync(fullPath); } catch {}
          decrypted++;
        } else {
          console.warn('[FileEncrypt] Failed to decrypt:', fullPath);
          failed++;
        }
      }
    }
  } catch (e) {
    console.warn('[FileEncrypt] Error decrypting directory:', dirPath, (e as Error).message);
  }
  
  return { decrypted, failed };
}

/**
 * Clear the decryption cache
 */
export function clearDecryptCache(): void {
  decryptCache.clear();
}

/**
 * Get the original filename without .enc extension
 * e.g., "q1.jpg.enc" -> "q1.jpg"
 */
export function getOriginalFilename(encFilePath: string): string {
  if (!encFilePath.endsWith('.enc')) return encFilePath;
  return encFilePath.slice(0, -4); // remove ".enc"
}
