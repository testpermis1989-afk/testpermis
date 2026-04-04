const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let nextProcess;

// Data directory - stored alongside the exe (or in app data for installed)
const getBasePath = () => {
  // Check if running from portable exe
  const exePath = app.getPath('exe');
  const exeDir = path.dirname(exePath);
  
  // If data folder exists next to exe, use it (portable mode)
  if (fs.existsSync(path.join(exeDir, 'data'))) {
    return exeDir;
  }
  
  // Otherwise use app data directory
  return path.join(app.getPath('appData'), 'PermisMaroc');
};

const fs = require('fs');
const basePath = getBasePath();
const dataDir = path.join(basePath, 'data');

// Ensure data directories exist
const uploadsDir = path.join(dataDir, 'uploads');
const tempDir = path.join(dataDir, 'temp-uploads');
const dbDir = path.join(basePath, 'db');

[uploadsDir, tempDir, dbDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'اختبار رخصة القيادة - Permis Maroc',
    icon: path.join(__dirname, '../public/icons/icon-512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    // Remove menu bar for cleaner look
    autoHideMenuBar: true,
  });

  // Load the Next.js app from the dev server
  const devServerUrl = 'http://localhost:3000';
  mainWindow.loadURL(devServerUrl);

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServer() {
  const nextAppDir = path.join(__dirname, '..');
  
  // Set environment variables for local mode
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    STORAGE_MODE: 'local',
    LOCAL_DATA_DIR: dataDir,
    DATABASE_URL: `file:${path.join(dbDir, 'permis.db')}`,
  };

  nextProcess = spawn('node', [path.join(nextAppDir, 'server.js')], {
    cwd: nextAppDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  nextProcess.stdout.on('data', (data) => {
    console.log(`[Next.js] ${data}`);
  });

  nextProcess.stderr.on('data', (data) => {
    console.error(`[Next.js] ${data}`);
  });

  nextProcess.on('close', (code) => {
    console.log(`[Next.js] exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  startNextServer();
  
  // Wait for Next.js to start before opening window
  setTimeout(() => {
    createWindow();
  }, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Kill Next.js server
    if (nextProcess) {
      nextProcess.kill();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});
