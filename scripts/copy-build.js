// Cross-platform copy script for post-build step
// Copies standalone build to 'app-server/' directory (visible name for electron-builder)
const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  if (!exists) {
    console.log(`Skipping ${src} (does not exist)`);
    return;
  }

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

const root = process.cwd();
const nextStandalone = path.join(root, '.next', 'standalone');
const appServer = path.join(root, 'app-server');

// Check standalone directory exists
if (!fs.existsSync(nextStandalone)) {
  console.error(`\nERROR: .next/standalone/ directory not found at ${nextStandalone}`);
  console.error('Make sure next.config.ts has output: "standalone"');
  process.exit(1);
}

// 1. Copy .next/static into standalone's .next/static
const standaloneStatic = path.join(nextStandalone, '.next', 'static');
const staticSource = path.join(root, '.next', 'static');
console.log('Copying .next/static to .next/standalone/.next/static ...');
copyRecursiveSync(staticSource, standaloneStatic);
console.log('Done.');

// 2. Copy public into standalone's public
const standalonePublic = path.join(nextStandalone, 'public');
const publicSource = path.join(root, 'public');
console.log('Copying public to .next/standalone/public ...');
copyRecursiveSync(publicSource, standalonePublic);
console.log('Done.');

// 3. Copy sql.js WASM file
const wasmSource = path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmDest = path.join(standalonePublic, 'sql-wasm.wasm');
if (fs.existsSync(wasmSource)) {
  console.log('Copying sql-wasm.wasm to standalone/public ...');
  fs.copyFileSync(wasmSource, wasmDest);
  console.log('Done.');
}

// 4. Copy sql.js module to standalone node_modules
const sqlJsDir = path.join(root, 'node_modules', 'sql.js');
const sqlJsDest = path.join(nextStandalone, 'node_modules', 'sql.js');
if (fs.existsSync(sqlJsDir)) {
  console.log('Copying sql.js to standalone/node_modules ...');
  copyRecursiveSync(sqlJsDir, sqlJsDest);
  console.log('Done.');
}

// 5. Copy .prisma engines to standalone node_modules
const prismaDir = path.join(root, 'node_modules', '.prisma');
const prismaDest = path.join(nextStandalone, 'node_modules', '.prisma');
if (fs.existsSync(prismaDir)) {
  console.log('Copying .prisma to standalone/node_modules ...');
  copyRecursiveSync(prismaDir, prismaDest);
  console.log('Done.');
}

// 6. Copy the complete standalone to 'app-server/' (visible dir for electron-builder)
console.log('Copying standalone build to app-server/ ...');
if (fs.existsSync(appServer)) {
  fs.rmSync(appServer, { recursive: true, force: true });
}
copyRecursiveSync(nextStandalone, appServer);
console.log('Done.');

// 7. Find the server entry point (server.js, index.js, or any main JS file)
const entryFiles = ['server.js', 'index.js', 'main.js'];
let foundEntry = null;

for (const f of entryFiles) {
  const fp = path.join(appServer, f);
  if (fs.existsSync(fp)) {
    foundEntry = f;
    break;
  }
}

// If none found, list what's in app-server for debugging
if (!foundEntry) {
  console.log('\nWARNING: Standard entry files not found. Listing app-server/ contents:');
  try {
    const entries = fs.readdirSync(appServer);
    for (const e of entries) {
      const stat = fs.statSync(path.join(appServer, e));
      console.log(`  ${stat.isDirectory() ? '[DIR]  ' : '[FILE] '}${e}`);
    }
  } catch (e) {
    console.error('  Could not list directory:', e.message);
  }
  process.exit(1);
}

console.log(`\nBuild ready! Entry point: app-server/${foundEntry}`);
console.log('Build post-process complete!');
