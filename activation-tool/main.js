const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

let mainWindow;

// =====================================================
// MACHINE CODE GENERATION
// =====================================================
function getMachineFingerprint() {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  const cpuCores = cpus.length.toString();
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();

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

function getMachineCode() {
  const hash = getMachineFingerprint();
  const code = hash.substring(0, 16).toUpperCase();
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

// =====================================================
// DATA STORAGE (JSON file)
// =====================================================
const DATA_DIR = path.join(path.dirname(app.getPath('exe')), 'data');
const DATA_FILE = path.join(DATA_DIR, 'activations.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return { activations: [], licenses: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return { activations: [], licenses: [] };
  }
}

function saveData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// =====================================================
// ADMIN PASSWORD MANAGEMENT
// =====================================================
function getDefaultConfig() {
  return { adminPassword: 'admin123' };
}

function loadConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(getDefaultConfig());
    return getDefaultConfig();
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return getDefaultConfig();
  }
}

function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// =====================================================
// ACTIVATION CODE GENERATION & VALIDATION
// Both use the machine CODE (XXXX-XXXX-XXXX-XXXX)
// so admin and client use the SAME value
// =====================================================
const DURATIONS = {
  '2d': 2,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6mo': 180,
  '1yr': 365,
  'unlimited': 36500,
};

const DURATION_LABELS = {
  '2d': '2 jours',
  '7d': '7 jours',
  '30d': '30 jours',
  '90d': '90 jours',
  '6mo': '6 mois',
  '1yr': '1 an',
  'unlimited': 'Illimitee',
};

// Secure activation: duration and date are HIDDEN inside the hash.
// Code format: XXXX-XXXX-XXXX-XXXX (16 chars, reveals nothing)
// Validation: extracts generation info from the code itself (XOR encoded)

function generateActivationCode(machineCode, durationCode) {
  const secret = 'PERMIS_MAROC_2025_SECRET_KEY';
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
  const payload = `${machineCode}|${infoNum}|${secret}`;
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

  // Code = SIGSIG-KEYKEY-ENCODED
  const code = `${sig.slice(0,4)}-${sig.slice(4,8)}-${encoded.slice(0,4)}-${encoded.slice(4,8)}`;
  return { code, durationLabel: label, durationCode, expiryDate };
}

function validateActivationCode(code, machineCode) {
  try {
    const secret = 'PERMIS_MAROC_2025_SECRET_KEY';
    const parts = code.replace(/-/g, '').toUpperCase();
    if (parts.length !== 16) return { valid: false, error: 'Format invalide' };

    const sigPart = parts.substring(0, 8);
    const encodedPart = parts.substring(8, 16);

    const today = Math.floor(Date.now() / 86400000);
    const durKeys = Object.keys(DURATIONS);

    // Try each duration (5 options) and each generation day (up to 365 back)
    for (let durIndex = 0; durIndex < durKeys.length; durIndex++) {
      for (let daysBack = 0; daysBack <= 365; daysBack++) {
        const genDay = today - daysBack;
        const infoNum = genDay * 10 + durIndex;

        const payload = `${machineCode}|${infoNum}|${secret}`;
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
            durationCode,
            durationLabel: DURATION_LABELS[durationCode],
            expiryDate,
          };
        }
      }
    }

    return { valid: false, error: 'Code invalide pour cette machine' };
  } catch {
    return { valid: false, error: 'Code invalide' };
  }
}

// =====================================================
// IPC HANDLERS
// =====================================================

// Get machine info
ipcMain.handle('get-machine-info', () => {
  return {
    machineCode: getMachineCode(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
  };
});

// Admin login
ipcMain.handle('admin-login', (event, password) => {
  const config = loadConfig();
  if (password === config.adminPassword) {
    return { success: true };
  }
  return { success: false, error: 'Mot de passe incorrect' };
});

// Change admin password
ipcMain.handle('change-admin-password', (event, oldPassword, newPassword) => {
  if (!oldPassword || !newPassword) {
    return { success: false, error: 'Remplissez tous les champs' };
  }
  if (newPassword.length < 4) {
    return { success: false, error: 'Le nouveau mot de passe doit avoir au moins 4 caracteres' };
  }
  const config = loadConfig();
  if (oldPassword !== config.adminPassword) {
    return { success: false, error: 'Ancien mot de passe incorrect' };
  }
  config.adminPassword = newPassword;
  saveConfig(config);
  return { success: true, message: 'Mot de passe modifie avec succes' };
});

// Generate activation code (admin)
// machineCode is what the admin enters (the client's machine code)
ipcMain.handle('generate-code', (event, machineCode, durationCode) => {
  const result = generateActivationCode(machineCode, durationCode);
  const data = loadData();

  // Add to licenses table
  data.licenses.push({
    activationCode: result.code,
    machineCode,
    durationCode: result.durationCode,
    durationLabel: result.durationLabel,
    expiryDate: result.expiryDate,
    clientName: '',
    createdAt: new Date().toISOString(),
  });

  // ALSO add to activations table so admin can track all active licenses
  // Remove any existing activation for this machine first
  data.activations = data.activations.filter(a => a.machineCode !== machineCode);
  data.activations.push({
    activationCode: result.code,
    machineCode,
    durationCode: result.durationCode,
    durationLabel: result.durationLabel,
    expiryDate: result.expiryDate,
    activatedAt: new Date().toISOString(),
  });

  saveData(data);
  return { success: true, ...result };
});

// Activate machine (client)
ipcMain.handle('activate', (event, activationCode) => {
  const machineCode = getMachineCode(); // This machine's code
  const result = validateActivationCode(activationCode, machineCode);

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  const data = loadData();

  // Remove old activation for this machine
  data.activations = data.activations.filter(a => a.machineCode !== machineCode);

  // Add new activation
  data.activations.push({
    activationCode,
    machineCode,
    durationCode: result.durationCode,
    durationLabel: result.durationLabel,
    expiryDate: result.expiryDate,
    activatedAt: new Date().toISOString(),
  });
  saveData(data);
  return { success: true, expiryDate: result.expiryDate, durationLabel: result.durationLabel };
});

// Get all activations (admin)
ipcMain.handle('get-activations', () => {
  const data = loadData();
  return data;
});

// Get activation status
ipcMain.handle('get-status', () => {
  const machineCode = getMachineCode();
  const data = loadData();
  const activation = data.activations.find(a => a.machineCode === machineCode);
  if (!activation) {
    return { activated: false, machineCode: getMachineCode() };
  }
  // Check if expired
  if (new Date(activation.expiryDate) < new Date()) {
    return { activated: false, machineCode: getMachineCode(), reason: 'expired', expiryDate: activation.expiryDate };
  }
  return { activated: true, ...activation, machineCode: getMachineCode() };
});

// Delete license (admin)
ipcMain.handle('delete-license', (event, code) => {
  const data = loadData();
  data.licenses = data.licenses.filter(l => l.activationCode !== code);
  data.activations = data.activations.filter(a => a.activationCode !== code);
  saveData(data);
  return { success: true };
});

// =====================================================
// WINDOW
// =====================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 550,
    title: 'Permis Maroc - Activation',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    backgroundColor: '#f5f5f5',
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
