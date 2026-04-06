// Machine ID generator - creates a unique identifier based on hardware
// Works in Electron (server-side) using os module
import os from 'os';
import crypto from 'crypto';

// Generate a stable machine ID based on hardware info
function getMachineFingerprint(): string {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  const cpuCores = cpus.length.toString();
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  
  // Get first non-internal network interface MAC address
  const networks = os.networkInterfaces();
  let mac = '';
  for (const name of Object.keys(networks)) {
    for (const iface of networks[name] || []) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        mac = iface.mac;
        break;
      }
    }
    if (mac) break;
  }

  const raw = `${hostname}|${platform}|${arch}|${cpuModel}|${cpuCores}|${mac}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Format machine ID as human-readable code: XXXX-XXXX-XXXX-XXXX
export function getMachineCode(): string {
  const hash = getMachineFingerprint();
  // Take first 16 hex chars and format as groups of 4
  const code = hash.substring(0, 16).toUpperCase();
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

// Get the raw machine hash (used internally for code generation)
export function getMachineHash(): string {
  return getMachineFingerprint();
}
