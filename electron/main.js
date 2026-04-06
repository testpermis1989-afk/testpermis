const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, fork } = require('child_process');
const http = require('http');

let mainWindow;
let nextProcess;
let serverReady = false;

// Data directory - stored alongside the exe (portable mode)
const basePath = path.dirname(app.getPath('exe'));
const dataDir = path.join(basePath, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const tempDir = path.join(dataDir, 'temp-uploads');
const dbDir = path.join(basePath, 'db');

// Ensure data directories exist
[uploadsDir, tempDir, dbDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Standalone server directory
const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
const serverJs = path.join(standaloneDir, 'server.js');

// Check if standalone build exists
function checkStandaloneExists() {
  // Check development mode (next dev) vs production (standalone)
  if (!fs.existsSync(standaloneDir) || !fs.existsSync(serverJs)) {
    return false;
  }
  return true;
}

// Poll server until ready
function waitForServer(port, maxRetries = 30) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        // Server is responding
        resolve(true);
      });
      req.on('error', () => {
        retries++;
        if (retries >= maxRetries) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(check, 1000);
        }
      });
      req.setTimeout(2000);
      req.on('timeout', () => {
        req.destroy();
        retries++;
        if (retries >= maxRetries) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(check, 1000);
        }
      });
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Permis Maroc - اختبار رخصة القيادة',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    autoHideMenuBar: true,
    show: false, // Show after ready
    backgroundColor: '#E0E0E0',
  });

  // Show loading screen first
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Disable dev tools in production
  if (process.env.NODE_ENV === 'production' || !process.argv.includes('--dev')) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }
}

// Start Next.js server using Electron's embedded Node.js
function startNextServer() {
  const isDev = process.argv.includes('--dev');
  const PORT = 3000;

  if (isDev) {
    // Development mode - assume user runs `next dev` separately
    console.log('[Electron] Development mode - waiting for next dev server on port 3000...');
    waitForServer(PORT).then(() => {
      serverReady = true;
      loadAppUrl(PORT);
    }).catch(() => {
      console.error('[Electron] Next.js dev server not found. Please run: STORAGE_MODE=local next dev -p 3000');
    });
    return;
  }

  if (!checkStandaloneExists()) {
    console.error(`[Electron] Standalone build not found at: ${standaloneDir}`);
    console.error('[Electron] Please run "npm run build" first');
    if (mainWindow) {
      showErrorPage('Build not found', 'Please run "npm run build" first to create the standalone build.');
    }
    return;
  }

  // Use ELECTRON_RUN_AS_NODE=1 to make Electron act as Node.js
  // This is the key fix: it allows running the standalone server.js
  // using Electron's built-in Node.js without needing a separate node.exe
  const electronExe = process.execPath;
  
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',  // KEY: Makes Electron behave as plain Node.js
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    STORAGE_MODE: 'local',
    LOCAL_DATA_DIR: dataDir,
    DATABASE_URL: `file:${path.join(dbDir, 'permis.db')}`,
  };

  console.log(`[Electron] Starting Next.js server with ELECTRON_RUN_AS_NODE=1...`);
  console.log(`[Electron] Executable: ${electronExe}`);
  console.log(`[Electron] Server script: ${serverJs}`);
  console.log(`[Electron] Data dir: ${dataDir}`);
  console.log(`[Electron] DB path: ${path.join(dbDir, 'permis.db')}`);

  nextProcess = spawn(electronExe, [serverJs], {
    cwd: standaloneDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });

  nextProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    console.log(`[Next.js] ${msg}`);
  });

  nextProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    console.error(`[Next.js:ERR] ${msg}`);
  });

  nextProcess.on('error', (err) => {
    console.error(`[Electron] Failed to start Next.js server: ${err.message}`);
    if (mainWindow) {
      showErrorPage('Server Error', `Failed to start: ${err.message}`);
    }
  });

  nextProcess.on('close', (code, signal) => {
    console.log(`[Next.js] Process exited with code ${code}, signal ${signal}`);
    serverReady = false;
  });

  // Wait for server to be ready
  waitForServer(PORT, 60).then(() => {
    console.log('[Electron] Next.js server is ready!');
    serverReady = true;
    loadAppUrl(PORT);
  }).catch((err) => {
    console.error(`[Electron] Server failed to start: ${err.message}`);
    if (mainWindow) {
      showErrorPage('Startup Error', `Server failed to start. Please try again.\n\n${err.message}`);
    }
  });
}

function loadAppUrl(port) {
  if (mainWindow) {
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }
}

function showErrorPage(title, message) {
  if (mainWindow) {
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Error</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; color: #333; }
          .container { text-align: center; padding: 40px; max-width: 500px; }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
          .icon { font-size: 64px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h1>${title}</h1>
          <p>${message}</p>
        </div>
      </body>
      </html>
    `)}`);
  }
}

// IPC handlers
ipcMain.handle('get-app-paths', () => {
  return {
    dataDir,
    uploadsDir,
    tempDir,
    dbDir,
    basePath,
    isElectron: true,
  };
});

ipcMain.handle('get-machine-info', () => {
  const os = require('os');
  const crypto = require('crypto');
  
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  const cpuCores = cpus.length.toString();
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  
  let mac = '';
  const networks = os.networkInterfaces();
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
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const code = hash.substring(0, 16).toUpperCase();
  const machineCode = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
  
  return { machineCode, machineHash: hash };
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  startNextServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (serverReady) {
        loadAppUrl(3000);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanupAndQuit();
  }
});

app.on('before-quit', () => {
  cleanupAndQuit();
});

function cleanupAndQuit() {
  if (nextProcess) {
    try {
      nextProcess.kill('SIGTERM');
    } catch (e) {
      // Process might already be dead
    }
    try {
      nextProcess.kill('SIGKILL');
    } catch (e) {
      // Ignore
    }
    nextProcess = null;
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] Unhandled Rejection:', reason);
});
