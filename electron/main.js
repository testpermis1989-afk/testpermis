const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let nextProcess;

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

// Find the node executable
// Electron bundles its own node, we can use it
function findNodeExe(): string {
  // Method 1: Use Electron's embedded node (works on all platforms)
  const electronExe = process.execPath;
  
  // Method 2: Try common node installation paths
  const nodePaths = [
    // Node installed globally
    process.env.NODE_PATH,
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe'),
    path.join(process.env.APPDATA || '', 'nvm', 'v24.13.1', 'node.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', 'node.exe'),
  ].filter(Boolean);

  for (const p of nodePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

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

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServer() {
  // Find standalone server directory
  const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');

  if (!fs.existsSync(standaloneDir)) {
    console.error(`Standalone directory not found: ${standaloneDir}`);
    return;
  }

  // Find node executable
  let nodeExe = findNodeExe();

  if (!nodeExe) {
    // Last resort: try using electron itself as node
    // Electron can run node scripts with --no-sandbox
    console.warn('Node.js not found in PATH, trying Electron as Node runtime...');
    nodeExe = process.execPath;
  }

  console.log(`Using Node: ${nodeExe}`);

  const serverJs = path.join(standaloneDir, 'server.js');

  // Set environment variables for local mode
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    HOSTNAME: '127.0.0.1',
    STORAGE_MODE: 'local',
    LOCAL_DATA_DIR: dataDir,
    DATABASE_URL: `file:${path.join(dbDir, 'permis.db')}`,
  };

  // Spawn the Next.js server as a child process
  nextProcess = spawn(nodeExe, [serverJs], {
    cwd: standaloneDir,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
  });

  nextProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    console.log(`[Next.js] ${msg}`);
    // Detect when server is ready
    if (msg.includes('Ready') || msg.includes('started') || msg.includes('3000')) {
      if (mainWindow && mainWindow.isLoading()) {
        mainWindow.loadURL('http://localhost:3000');
      }
    }
  });

  nextProcess.stderr.on('data', (data) => {
    console.error(`[Next.js] ${data.toString().trim()}`);
  });

  nextProcess.on('error', (err) => {
    console.error('Failed to start Next.js server:', err.message);
    // Show error in window if available
    if (mainWindow) {
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(`
        <html><body style="font-family:Arial;text-align:center;padding:50px">
          <h2 style="color:red">Erreur de démarrage</h2>
          <p>Impossible de lancer le serveur : ${err.message}</p>
          <p>Assurez-vous que Node.js est installé.</p>
          <p><a href="https://nodejs.org" target="_blank">Télécharger Node.js</a></p>
        </body></html>
      `)}`);
    }
  });

  nextProcess.on('close', (code) => {
    console.log(`[Next.js] exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  startNextServer();

  // Wait for server to start before opening window
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
    if (nextProcess) nextProcess.kill();
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextProcess) nextProcess.kill();
});
