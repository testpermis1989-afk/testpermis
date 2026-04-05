const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Data directory - stored alongside the exe (portable mode)
const getBasePath = () => {
  // In portable mode, data is next to the exe
  const exePath = app.getPath('exe');
  const exeDir = path.dirname(exePath);
  return exeDir;
};

const basePath = getBasePath();
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'اختبار رخصة القيادة - Permis Maroc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
  });

  // Load the Next.js app from the embedded server
  mainWindow.loadURL('http://localhost:3000');

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
  // Set environment variables for local mode BEFORE requiring the server
  process.env.NODE_ENV = 'production';
  process.env.PORT = '3000';
  process.env.HOSTNAME = '127.0.0.1';
  process.env.STORAGE_MODE = 'local';
  process.env.LOCAL_DATA_DIR = dataDir;
  process.env.DATABASE_URL = `file:${path.join(dbDir, 'permis.db')}`;

  // Find the standalone server directory
  // In dev: __dirname = project/electron, standalone = project/.next/standalone
  // In packaged: __dirname = resources/app/electron, standalone = resources/app/.next/standalone
  const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');

  if (!fs.existsSync(standaloneDir)) {
    console.error(`Standalone directory not found: ${standaloneDir}`);
    console.error('Make sure "npm run build" was run before packaging.');
    return;
  }

  // Change working directory to standalone so Next.js can find its files
  process.chdir(standaloneDir);

  // Start the Next.js server directly in this process (no child process needed!)
  console.log('Starting Next.js server in-process...');
  try {
    require(path.join(standaloneDir, 'server.js'));
    console.log('Next.js server started successfully.');
  } catch (err) {
    console.error('Failed to start Next.js server:', err);
  }
}

app.whenReady().then(() => {
  // Start Next.js server first (synchronous - server.listen is async)
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
    app.quit();
  }
});
