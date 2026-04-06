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
// ACTIVATION CODE GENERATION & VALIDATION
// Both use the machine CODE (XXXX-XXXX-XXXX-XXXX)
// so admin and client use the SAME value
// =====================================================
const DURATIONS = {
  '30d': 30,
  '90d': 90,
  '6mo': 180,
  '1yr': 365,
  'unlimited': 36500,
};

const DURATION_LABELS = {
  '30d': '30 jours',
  '90d': '90 jours',
  '6mo': '6 mois',
  '1yr': '1 an',
  'unlimited': 'Illimitee',
};

function generateActivationCode(machineCode, durationCode) {
  // machineCode format: XXXX-XXXX-XXXX-XXXX (16 chars uppercase)
  const secret = 'PERMIS_MAROC_2025_SECRET_KEY';
  const days = DURATIONS[durationCode] || 30;
  const label = DURATION_LABELS[durationCode] || '30 jours';

  const now = new Date();
  const expiryDate = durationCode === 'unlimited'
    ? '2099-12-31'
    : new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Use machineCode (not hash) for signature - both admin and client have this value
  const payload = `${machineCode}|${durationCode}|${expiryDate}|${secret}`;
  const signature = crypto.createHash('sha256').update(payload).digest('hex').substring(0, 8).toUpperCase();

  const code = `${signature}-${durationCode.toUpperCase()}-${expiryDate.replace(/-/g, '').substring(2)}`;
  return { code, durationLabel: label, durationCode, expiryDate };
}

function validateActivationCode(code, machineCode) {
  try {
    const parts = code.split('-');
    if (parts.length < 3) return { valid: false, error: 'Format invalide' };

    // Extract duration from parts[1]
    const durationCode = parts[1].toLowerCase();
    if (!DURATIONS[durationCode]) return { valid: false, error: 'Code invalide' };

    // Regenerate expected code using this machine's code
    const expected = generateActivationCode(machineCode, durationCode);

    if (expected.code === code) {
      // Check expiry
      if (durationCode !== 'unlimited' && new Date(expected.expiryDate) < new Date()) {
        return { valid: false, error: 'Code expire' };
      }
      return {
        valid: true,
        durationCode,
        durationLabel: expected.durationLabel,
        expiryDate: expected.expiryDate,
      };
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
  if (password === 'admin123') {
    return { success: true };
  }
  return { success: false, error: 'Mot de passe incorrect' };
});

// Generate activation code (admin)
// machineCode is what the admin enters (the client's machine code)
ipcMain.handle('generate-code', (event, machineCode, durationCode) => {
  const result = generateActivationCode(machineCode, durationCode);
  const data = loadData();
  data.licenses.push({
    activationCode: result.code,
    machineCode,
    durationCode: result.durationCode,
    durationLabel: result.durationLabel,
    expiryDate: result.expiryDate,
    clientName: '',
    createdAt: new Date().toISOString(),
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
