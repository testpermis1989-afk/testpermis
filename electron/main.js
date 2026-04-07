const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
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

// Find server entry point file (server.js, index.js, or main.js)
const ENTRY_FILES = ['server.js', 'index.js', 'main.js'];

function findEntryFile(dir) {
  for (const f of ENTRY_FILES) {
    const fp = path.join(dir, f);
    if (fs.existsSync(fp)) return f;
  }
  return null;
}

// Find standalone server directory
function findServerDir() {
  const isPackaged = app.isPackaged;

  if (isPackaged) {
    // Packaged app: app-server is in resources/app/app-server/
    // When asar is enabled, app.getAppPath() returns the asar path
    const appPath = app.getAppPath();
    const dirs = [
      path.join(appPath, 'app-server'),
      path.join(__dirname, '..', 'app-server'),
      path.join(path.dirname(process.execPath), 'resources', 'app', 'app-server'),
      path.join(appPath, '.next', 'standalone'),
    ];
    for (const d of dirs) {
      if (findEntryFile(d)) return { dir: d, entry: findEntryFile(d) };
    }
    console.error('[Electron] Server entry NOT found in packaged app. Tried:');
    dirs.forEach((d, i) => console.error(`  ${i+1}. ${d}`));
    return null;
  } else {
    // Development: look in project root
    const dirs = [
      path.join(__dirname, '..', 'app-server'),
      path.join(__dirname, '..', '.next', 'standalone'),
    ];
    for (const d of dirs) {
      if (findEntryFile(d)) return { dir: d, entry: findEntryFile(d) };
    }
    console.error('[Electron] Server entry NOT found in dev mode. Tried:');
    dirs.forEach((d, i) => console.error(`  ${i+1}. ${d}`));
    return null;
  }
}

// Poll server until ready
function waitForServer(port, maxRetries = 60) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
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
    show: false,
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
}

// Start Next.js server
function startNextServer() {
  const isDev = process.argv.includes('--dev');
  const PORT = 3000;

  if (isDev) {
    console.log('[Electron] Development mode - waiting for next dev server on port 3000...');
    waitForServer(PORT).then(() => {
      serverReady = true;
      loadAppUrl(PORT);
    }).catch(() => {
      console.error('[Electron] Next.js dev server not found.');
    });
    return;
  }

  const serverInfo = findServerDir();
  if (!serverInfo) {
    console.error('[Electron] Standalone build not found!');
    if (mainWindow) {
      showErrorPage('Build not found',
        'The application server files are missing.\n\n' +
        'Please run: BUILD.bat'
      );
    }
    return;
  }

  const serverDir = serverInfo.dir;
  const serverEntry = serverInfo.entry;
  const serverJs = path.join(serverDir, serverEntry);
  console.log(`[Electron] Server directory: ${serverDir}`);
  console.log(`[Electron] Server script: ${serverJs}`);

  // Use ELECTRON_RUN_AS_NODE=1 to make Electron act as Node.js
  const electronExe = process.execPath;

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    STORAGE_MODE: 'local',
    LOCAL_DATA_DIR: dataDir,
    DATABASE_URL: `file:${path.join(dbDir, 'permis.db')}`,
  };

  console.log(`[Electron] Starting Next.js server on port ${PORT}...`);
  console.log(`[Electron] Data dir: ${dataDir}`);
  console.log(`[Electron] DB path: ${path.join(dbDir, 'permis.db')}`);

  nextProcess = spawn(electronExe, [serverJs], {
    cwd: serverDir,
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
    console.error(`[Electron] Failed to start server: ${err.message}`);
    if (mainWindow) {
      showErrorPage('Server Error', `Failed to start: ${err.message}`);
    }
  });

  nextProcess.on('close', (code, signal) => {
    console.log(`[Next.js] Process exited with code ${code}`);
    serverReady = false;
  });

  // Wait for server
  waitForServer(PORT, 60).then(() => {
    console.log('[Electron] Next.js server is ready!');
    serverReady = true;
    loadAppUrl(PORT);
  }).catch((err) => {
    console.error(`[Electron] Server failed: ${err.message}`);
    if (mainWindow) {
      showErrorPage('Startup Error',
        `Server failed to start after 60 seconds.\n\n` +
        `Please reinstall: PermisMaroc-Setup.exe`
      );
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
          p { color: #666; line-height: 1.6; white-space: pre-line; }
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
  return { dataDir, uploadsDir, tempDir, dbDir, basePath, isElectron: true };
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
      if (serverReady) loadAppUrl(3000);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') cleanupAndQuit();
});

app.on('before-quit', () => cleanupAndQuit());

function cleanupAndQuit() {
  if (nextProcess) {
    try { nextProcess.kill('SIGTERM'); } catch (e) {}
    try { nextProcess.kill('SIGKILL'); } catch (e) {}
    nextProcess = null;
  }
}

process.on('uncaughtException', (err) => console.error('[Electron] Uncaught:', err));
process.on('unhandledRejection', (reason) => console.error('[Electron] Rejection:', reason));
