const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let nextProcess;
let serverReady = false;
let serverStderr = []; // Capture stderr for error display
let serverStdout = []; // Capture stdout for diagnostics
let serverCrashed = false;

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
    // Packaged app: app-server is placed in resources/app-server/ via extraResources
    // This is OUTSIDE the asar so it's a real filesystem directory (needed for spawn cwd)
    const resourcesPath = process.resourcesPath;
    const dirs = [
      path.join(resourcesPath, 'app-server'),
      path.join(__dirname, '..', 'resources', 'app-server'),
      path.join(path.dirname(process.execPath), 'resources', 'app-server'),
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
      if (serverCrashed) {
        reject(new Error('Server process crashed'));
        return;
      }
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
      const resourcesPath = process.resourcesPath;
      showErrorPage('Build not found',
        `Server files not found.\n\n` +
        `Resources path: ${resourcesPath}\n` +
        `Checked: ${resourcesPath}/app-server/\n\n` +
        `Please reinstall: PermisMaroc-Setup.exe`
      );
    }
    return;
  }

  const serverDir = serverInfo.dir;
  const serverEntry = serverInfo.entry;
  const serverJs = path.join(serverDir, serverEntry);
  console.log(`[Electron] Server directory: ${serverDir}`);
  console.log(`[Electron] Server script: ${serverJs}`);
  console.log(`[Electron] resourcesPath: ${process.resourcesPath}`);
  console.log(`[Electron] app.isPackaged: ${app.isPackaged}`);

  // Verify the server script exists and is readable
  if (!fs.existsSync(serverJs)) {
    const errMsg = `Server script not found: ${serverJs}`;
    console.error(`[Electron] ${errMsg}`);
    showErrorPage('File Not Found', errMsg);
    return;
  }

  // Verify node_modules exists
  const nmDir = path.join(serverDir, 'node_modules');
  if (!fs.existsSync(nmDir)) {
    const errMsg = `node_modules not found at: ${nmDir}\n\nThe app-server directory is incomplete.`;
    console.error(`[Electron] ${errMsg}`);
    showErrorPage('Missing Dependencies', errMsg);
    return;
  }

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

  // Reset capture buffers
  serverStderr = [];
  serverStdout = [];
  serverCrashed = false;

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
    serverStdout.push(msg);
  });

  nextProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    console.error(`[Next.js:ERR] ${msg}`);
    serverStderr.push(msg);
  });

  nextProcess.on('error', (err) => {
    const errMsg = `Failed to start process: ${err.message}`;
    console.error(`[Electron] ${errMsg}`);
    serverCrashed = true;
    if (mainWindow) {
      showErrorPage('Server Error', errMsg);
    }
  });

  nextProcess.on('close', (code, signal) => {
    console.log(`[Next.js] Process exited with code ${code}, signal ${signal}`);
    if (code !== 0 && code !== null) {
      serverCrashed = true;
      console.error(`[Electron] Server crashed with exit code ${code}`);
      // If server crashes before becoming ready, show error immediately
      if (!serverReady && mainWindow) {
        const errOutput = serverStderr.join('\n').slice(-2000);
        const outOutput = serverStdout.join('\n').slice(-1000);
        showErrorPage('Server Crash',
          `The server process exited unexpectedly (code: ${code}).\n\n` +
          `--- Server Output ---\n${outOutput || '(no output)'}\n\n` +
          `--- Error Output ---\n${errOutput || '(no errors)'}\n\n` +
          `--- Diagnostics ---\n` +
          `CWD: ${serverDir}\n` +
          `Script: ${serverJs}\n` +
          `Electron: ${electronExe}\n` +
          `Node version: ${process.versions.node}`
        );
      }
    }
    serverReady = false;
  });

  // Wait for server
  waitForServer(PORT, 60).then(() => {
    console.log('[Electron] Next.js server is ready!');
    serverReady = true;
    loadAppUrl(PORT);
  }).catch((err) => {
    console.error(`[Electron] Server failed: ${err.message}`);
    if (mainWindow && !serverCrashed) {
      const errOutput = serverStderr.join('\n').slice(-2000);
      const outOutput = serverStdout.join('\n').slice(-1000);
      showErrorPage('Startup Error',
        `Server failed to start after 60 seconds.\n\n` +
        `--- Server Output ---\n${outOutput || '(no output)'}\n\n` +
        `--- Error Output ---\n${errOutput || '(no errors)'}\n\n` +
        `--- Diagnostics ---\n` +
        `CWD: ${serverDir}\n` +
        `Script: ${serverJs}\n` +
        `Resources: ${process.resourcesPath}\n` +
        `Node version: ${process.versions.node}\n\n` +
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
    // Escape message for HTML
    const escapedMessage = message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const escapedTitle = title
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    mainWindow.loadURL(`data:text/html,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Error</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; color: #333; }
          .container { text-align: center; padding: 40px; max-width: 700px; width: 100%; }
          h1 { color: #e74c3c; margin-bottom: 20px; font-size: 24px; }
          .error-box { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; text-align: left; max-height: 60vh; overflow-y: auto; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; line-height: 1.5; color: #555; white-space: pre-wrap; word-break: break-all; }
          .icon { font-size: 64px; margin-bottom: 20px; }
          .footer { margin-top: 20px; color: #999; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h1>${escapedTitle}</h1>
          <div class="error-box">${escapedMessage}</div>
          <div class="footer">Permis Maroc v1.0</div>
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
