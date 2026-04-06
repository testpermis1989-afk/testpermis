// Cross-platform copy script for post-build step
// Works on both Windows and Unix
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
const standaloneStatic = path.join(root, '.next', 'standalone', '.next', 'static');
const standalonePublic = path.join(root, '.next', 'standalone', 'public');
const standaloneNodeModules = path.join(root, '.next', 'standalone', 'node_modules');
const staticSource = path.join(root, '.next', 'static');
const publicSource = path.join(root, 'public');

console.log('Copying .next/static to .next/standalone/.next/static ...');
copyRecursiveSync(staticSource, standaloneStatic);
console.log('Done.');

console.log('Copying public to .next/standalone/public ...');
copyRecursiveSync(publicSource, standalonePublic);
console.log('Done.');

// Copy sql.js WASM file to standalone public (for runtime loading)
const wasmSource = path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmDest = path.join(standalonePublic, 'sql-wasm.wasm');
if (fs.existsSync(wasmSource)) {
  console.log('Copying sql-wasm.wasm to standalone/public ...');
  fs.copyFileSync(wasmSource, wasmDest);
  console.log('Done.');
} else {
  console.log('Warning: sql-wasm.wasm not found in node_modules, skipping.');
}

// Copy sql.js module to standalone node_modules (needed for server-side import)
const sqlJsDir = path.join(root, 'node_modules', 'sql.js');
const sqlJsDest = path.join(standaloneNodeModules, 'sql.js');
if (fs.existsSync(sqlJsDir)) {
  console.log('Copying sql.js to standalone/node_modules ...');
  copyRecursiveSync(sqlJsDir, sqlJsDest);
  console.log('Done.');
} else {
  console.log('Warning: sql.js not found in node_modules, skipping.');
}

console.log('Build post-process complete!');
