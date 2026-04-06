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

// Verify
const serverJs = path.join(appServer, 'server.js');
if (fs.existsSync(serverJs)) {
  console.log(`\n✅ Build ready! server.js at: ${serverJs}`);
} else {
  console.error(`\n❌ ERROR: server.js NOT found at ${serverJs}`);
  process.exit(1);
}

console.log('Build post-process complete!');
