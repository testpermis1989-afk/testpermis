// Cross-platform copy script for post-build step
// Copies standalone build to 'app-server/' directory and STRIPS unnecessary files
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

function removeRecursiveSync(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  Removed: ${dir}`);
  } catch (e) {
    console.log(`  Warning: Could not remove ${dir}: ${e.message}`);
  }
}

function removeFile(file) {
  if (!fs.existsSync(file)) return;
  try {
    fs.unlinkSync(file);
    console.log(`  Removed: ${file}`);
  } catch (e) {
    console.log(`  Warning: Could not remove ${file}: ${e.message}`);
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

// 2. Copy public into standalone's public (but exclude large unnecessary files)
const standalonePublic = path.join(nextStandalone, 'public');
const publicSource = path.join(root, 'public');
console.log('Copying public to .next/standalone/public ...');
copyRecursiveSync(publicSource, standalonePublic);

// Remove ZIP files and other unnecessary items from standalone public
const unwantedPublicFiles = [
  path.join(standalonePublic, 'TestPermis_Desktop.zip'),
  path.join(standalonePublic, 'PermisMaroc-Activation.zip'),
];
console.log('\nRemoving unnecessary files from standalone/public:');
for (const f of unwantedPublicFiles) {
  removeFile(f);
}
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

// ========== STRIP UNNECESSARY FILES FROM STANDALONE ==========
console.log('\n=== STRIPPING UNNECESSARY FILES ===\n');

const nm = path.join(nextStandalone, 'node_modules');

// Remove Linux sharp binaries (app is Windows-only, saves ~33M)
console.log('Removing Linux sharp binaries...');
removeRecursiveSync(path.join(nm, '@img', 'sharp-libvips-linux-x64'));
removeRecursiveSync(path.join(nm, '@img', 'sharp-libvips-linuxmusl-x64'));
removeRecursiveSync(path.join(nm, '@img', 'sharp-linux-x64'));
removeRecursiveSync(path.join(nm, '@img', 'sharp-linuxmusl-x64'));
// Keep @img/colour (tiny, 56K)

// Remove typescript (not needed at runtime, saves ~20M)
console.log('Removing typescript (not needed at runtime)...');
removeRecursiveSync(path.join(nm, 'typescript'));

// Remove sql.js WASM duplicate and all unnecessary files from node_modules (saves ~18M)
// Keep only: sql-wasm.js (Node.js wrapper) + worker.sql-wasm.js (web worker)
// WASM is served from public/sql-wasm.wasm
console.log('Removing sql.js unnecessary files from node_modules...');
const sqlJsDist = path.join(nm, 'sql.js', 'dist');
// Remove all ASM files (we use WASM only)
removeFile(path.join(sqlJsDist, 'sql-asm.js'));
removeFile(path.join(sqlJsDist, 'sql-asm-debug.js'));
removeFile(path.join(sqlJsDist, 'worker.sql-asm.js'));
removeFile(path.join(sqlJsDist, 'worker.sql-asm-debug.js'));
// Remove all debug files
removeFile(path.join(sqlJsDist, 'sql-wasm-debug.js'));
removeFile(path.join(sqlJsDist, 'sql-wasm-debug.wasm'));
removeFile(path.join(sqlJsDist, 'worker.sql-wasm-debug.js'));
// Remove browser WASM (served from public/)
removeFile(path.join(sqlJsDist, 'sql-wasm.wasm'));
removeFile(path.join(sqlJsDist, 'sql-wasm-browser.wasm'));
removeFile(path.join(sqlJsDist, 'sql-wasm-browser.js'));
removeFile(path.join(sqlJsDist, 'sql-wasm-browser-debug.js'));
removeFile(path.join(sqlJsDist, 'sql-wasm-browser-debug.wasm'));
// Remove docs and unnecessary files
removeFile(path.join(nm, 'sql.js', 'README.md'));
removeFile(path.join(nm, 'sql.js', 'LICENSE'));
removeFile(path.join(nm, 'sql.js', 'AUTHORS'));
removeFile(path.join(nm, 'sql.js', 'CONTRIBUTING.md'));
removeFile(path.join(nm, 'sql.js', 'documentation_index.md'));
removeFile(path.join(nm, 'sql.js', 'logo.svg'));
removeFile(path.join(nm, 'sql.js', 'eslint.config.cjs'));

// Remove source-map-support (saves ~108K, not needed in prod)
console.log('Removing source-map-support...');
removeRecursiveSync(path.join(nm, 'source-map-support'));

// Remove source-map (saves ~136K, not needed in prod)
console.log('Removing source-map...');
removeRecursiveSync(path.join(nm, 'source-map'));

// Remove Prisma engines (not needed - we use sql.js for local mode)
console.log('Removing Prisma engines (using sql.js for local mode)...');
removeRecursiveSync(path.join(nm, '.prisma'));
removeRecursiveSync(path.join(nm, '@prisma', 'engines'));
removeRecursiveSync(path.join(nm, 'prisma'));

// Remove unnecessary large packages not needed at runtime
console.log('Removing unnecessary dev-only packages...');
removeRecursiveSync(path.join(nm, 'eslint'));
removeRecursiveSync(path.join(nm, '@eslint'));
removeRecursiveSync(path.join(nm, 'postcss'));
removeRecursiveSync(path.join(nm, 'tailwindcss'));
removeRecursiveSync(path.join(nm, '@tailwindcss'));
removeRecursiveSync(path.join(nm, 'typescript'));

// Remove test/debug utilities
console.log('Removing test/debug utilities...');
removeRecursiveSync(path.join(nm, 'jest'));
removeRecursiveSync(path.join(nm, '@jest'));
removeRecursiveSync(path.join(nm, 'ts-jest'));
removeRecursiveSync(path.join(nm, '@testing-library'));

// Remove electron-builder related (not needed in runtime)
console.log('Removing electron-builder...');
removeRecursiveSync(path.join(nm, 'electron-builder'));

// Remove FFmpeg native binaries if present (large, ~50MB)
console.log('Removing FFmpeg binaries (not needed in local mode)...');
removeRecursiveSync(path.join(nm, 'ffmpeg-static'));
removeRecursiveSync(path.join(nm, 'ffprobe-static'));

// Remove CHANGES/CHANGELOG/AUTHORS/README files recursively from all packages (saves ~30MB)
console.log('Removing documentation files from all packages...');
function removeDocFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['docs', 'doc', 'examples', 'example', 'coverage', '.github', 'website', 'www'].includes(entry.name)) {
          removeRecursiveSync(fullPath);
        } else {
          removeDocFilesRecursive(fullPath);
        }
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        if (name === 'changes.md' || name === 'changelog.md' || name === 'changelog.txt' ||
            name === 'authors' || name === 'authors.md' || name === 'contributors.md' ||
            name === 'history.md' || name === 'release-notes.md' || name === 'migrate.md' ||
            name.startsWith('.eslintrc') || name === '.prettierrc' || name === '.editorconfig' ||
            name === 'jest.config.js' || name === 'jest.config.ts' || name === 'vitest.config.ts') {
          removeFile(fullPath);
        }
      }
    }
  } catch (e) {
    // Ignore permission errors
  }
}
removeDocFilesRecursive(nm);

// Remove macOS sharp binaries (app is Windows-only, saves ~25MB)
console.log('Removing macOS sharp binaries...');
removeRecursiveSync(path.join(nm, '@img', 'sharp-libvips-darwin-x64'));
removeRecursiveSync(path.join(nm, '@img', 'sharp-libvips-darwin-arm64'));
removeRecursiveSync(path.join(nm, '@img', 'sharp-darwin-x64'));
removeRecursiveSync(path.join(nm, '@img', 'sharp-darwin-arm64'));

console.log('\n=== STRIPPING COMPLETE ===\n');

// 6. Copy the complete standalone to 'app-server/'
console.log('Copying standalone build to app-server/ ...');
if (fs.existsSync(appServer)) {
  fs.rmSync(appServer, { recursive: true, force: true });
}
copyRecursiveSync(nextStandalone, appServer);

// 7. Remove unnecessary directories and files from app-server
console.log('\nRemoving unnecessary directories from app-server...');
removeRecursiveSync(path.join(appServer, 'skills'));
removeRecursiveSync(path.join(appServer, 'upload'));
removeRecursiveSync(path.join(appServer, 'examples'));
removeRecursiveSync(path.join(appServer, '.prisma'));
removeRecursiveSync(path.join(appServer, 'activation-tool'));
removeRecursiveSync(path.join(appServer, 'scripts'));
removeRecursiveSync(path.join(appServer, 'prisma'));
removeRecursiveSync(path.join(appServer, 'electron'));
removeRecursiveSync(path.join(appServer, 'chat-archive.md'));
removeRecursiveSync(path.join(appServer, 'worklog.md'));
removeRecursiveSync(path.join(appServer, 'bun.lock'));
removeRecursiveSync(path.join(appServer, 'eslint.config.mjs'));
removeRecursiveSync(path.join(appServer, 'eslint.config.mjs.ignore'));
removeRecursiveSync(path.join(appServer, 'vercel.json'));
removeRecursiveSync(path.join(appServer, 'components.json'));
removeRecursiveSync(path.join(appServer, 'Caddyfile'));
removeRecursiveSync(path.join(appServer, 'BUILD.bat'));
removeRecursiveSync(path.join(appServer, 'LAUNCH.bat'));
removeRecursiveSync(path.join(appServer, 'dev.sh'));
removeRecursiveSync(path.join(appServer, 'run-dev.sh'));
removeRecursiveSync(path.join(appServer, 'self-heal.sh'));
removeRecursiveSync(path.join(appServer, 'tailwind.config.ts'));
removeRecursiveSync(path.join(appServer, 'postcss.config.mjs'));
removeRecursiveSync(path.join(appServer, 'tsconfig.json'));
removeRecursiveSync(path.join(appServer, 'package.json'));
removeRecursiveSync(path.join(appServer, 'next.config.ts'));

// 7b. Create .npmignore to allow node_modules (override parent .gitignore)
// electron-builder respects .npmignore, so we need to explicitly allow node_modules
fs.writeFileSync(path.join(appServer, '.npmignore'), '# Allow node_modules for electron-builder extraResources\n!node_modules/\n');
console.log('Created .npmignore for app-server (allows node_modules in electron build)');
console.log('Done.');

// 8. Find the server entry point
const entryFiles = ['server.js', 'index.js', 'main.js'];
let foundEntry = null;

for (const f of entryFiles) {
  const fp = path.join(appServer, f);
  if (fs.existsSync(fp)) {
    foundEntry = f;
    break;
  }
}

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

// Show final size
const getAppServerSize = (dir) => {
  let size = 0;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      size += getAppServerSize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }
  return size;
};

const totalSize = getAppServerSize(appServer);
const totalMB = (totalSize / (1024 * 1024)).toFixed(1);

console.log(`\n========================================`);
console.log(`Build ready! Entry point: app-server/${foundEntry}`);
console.log(`Total app-server size: ${totalMB} MB`);
console.log(`========================================`);
console.log('Build post-process complete!');
