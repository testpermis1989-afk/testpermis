// afterPack hook for electron-builder
// This runs AFTER the asar is created and copies app-server/ into the resources directory
// This is more reliable than extraResources for large directories with node_modules (symlinks, etc.)
const path = require('path');
const fs = require('fs');

function copyRecursiveSync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      // Skip symlinks to avoid issues - resolve them and copy the target
      if (fs.lstatSync(srcPath).isSymbolicLink()) {
        try {
          const realPath = fs.realpathSync(srcPath);
          if (fs.existsSync(realPath)) {
            copyRecursiveSync(realPath, destPath);
          } else {
            console.log(`  [afterPack] Skipping broken symlink: ${srcPath} -> ${realPath}`);
          }
        } catch (e) {
          console.log(`  [afterPack] Skipping symlink: ${srcPath} (${e.message})`);
        }
        continue;
      }
      copyRecursiveSync(srcPath, destPath);
    }
  } else {
    // Ensure directory exists
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function getDirectorySize(dir) {
  let size = 0;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      size += getDirectorySize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }
  return size;
}

exports.default = async function afterPack(context) {
  const { appOutDir, packager } = context;
  const { platform, arch } = packager;
  const appName = packager.appInfo.productFilename;

  console.log(`\n========================================`);
  console.log(`[afterPack] Starting for ${appName} (${platform}-${arch})`);
  console.log(`[afterPack] Output dir: ${appOutDir}`);
  console.log(`========================================\n`);

  const rootDir = process.cwd();
  const appServerSrc = path.join(rootDir, 'app-server');

  // Check app-server exists
  if (!fs.existsSync(appServerSrc)) {
    console.error(`[afterPack] ERROR: app-server/ not found at ${appServerSrc}`);
    console.error('[afterPack] Did you run "npm run build:electron" first?');
    process.exit(1);
  }

  // Verify node_modules exists in app-server
  const nmDir = path.join(appServerSrc, 'node_modules');
  if (!fs.existsSync(nmDir)) {
    console.error(`[afterPack] ERROR: node_modules not found in app-server/`);
    console.error('[afterPack] The copy-build.js script did not include node_modules.');
    process.exit(1);
  }

  // Verify server entry point exists
  const entryFiles = ['server.js', 'index.js', 'main.js'];
  let serverEntry = null;
  for (const f of entryFiles) {
    if (fs.existsSync(path.join(appServerSrc, f))) {
      serverEntry = f;
      break;
    }
  }
  if (!serverEntry) {
    console.error('[afterPack] ERROR: No server entry file found in app-server/');
    process.exit(1);
  }
  console.log(`[afterPack] Server entry: ${serverEntry}`);

  // Determine the resources directory
  // For NSIS installer on Windows: appOutDir/resources/
  const resourcesDir = path.join(appOutDir, 'resources');
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }

  const appServerDest = path.join(resourcesDir, 'app-server');

  // Remove existing app-server if present (from previous build)
  if (fs.existsSync(appServerDest)) {
    console.log('[afterPack] Removing previous app-server from resources...');
    fs.rmSync(appServerDest, { recursive: true, force: true });
  }

  // Copy app-server to resources
  console.log('[afterPack] Copying app-server/ to resources/app-server/ ...');
  console.log(`[afterPack] Source: ${appServerSrc}`);
  console.log(`[afterPack] Dest:   ${appServerDest}`);

  const startTime = Date.now();
  copyRecursiveSync(appServerSrc, appServerDest);
  const copyTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Verify the copy
  if (!fs.existsSync(path.join(appServerDest, serverEntry))) {
    console.error(`[afterPack] ERROR: Server entry ${serverEntry} not found after copy!`);
    process.exit(1);
  }

  if (!fs.existsSync(path.join(appServerDest, 'node_modules'))) {
    console.error('[afterPack] ERROR: node_modules not found after copy!');
    process.exit(1);
  }

  const srcSizeMB = (getDirectorySize(appServerSrc) / (1024 * 1024)).toFixed(1);
  const destSizeMB = (getDirectorySize(appServerDest) / (1024 * 1024)).toFixed(1);

  console.log(`[afterPack] Copy completed in ${copyTime}s`);
  console.log(`[afterPack] Source size: ${srcSizeMB} MB`);
  console.log(`[afterPack] Dest size:   ${destSizeMB} MB`);
  console.log(`[afterPack] app-server/ successfully copied to resources/\n`);

  // Also verify the .next/static directory
  const staticDir = path.join(appServerDest, '.next', 'static');
  if (!fs.existsSync(staticDir)) {
    console.warn('[afterPack] WARNING: .next/static/ not found - the app may not load correctly');
  }

  console.log('========================================');
  console.log('[afterPack] Done!');
  console.log('========================================');
};
