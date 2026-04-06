#!/usr/bin/env node
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const root = '/home/z/my-project';
const outputPath = path.join(root, 'download', 'TestPermis_Desktop.zip');

fs.mkdirSync(path.join(root, 'download'), { recursive: true });
if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

const zip = new AdmZip();

const includes = [
  'src', 'electron', 'scripts', 'prisma', 'public',
  'package.json', 'next.config.ts', 'tsconfig.json',
  'postcss.config.mjs', 'tailwind.config.ts',
  'eslint.config.mjs', 'components.json',
  'BUILD.bat',
];

const excludePatterns = [
  /node_modules/, /\.next/, /dist-electron/, /app-server/, /download/,
  /\.git/, /\.env/, /\.db$/, /dev\.log/, /server\.log/, /skills/,
  /mini-services/, /examples/, /data/, /\/upload\//, /bun\.lock/,
  /\.claude/, /\.z-ai-config/, /self-heal/, /run-dev/, /dev\.sh/,
  /Caddyfile/, /chat-archive/, /TODO/, /prompt/, /test$/,
  /pyproject/, /uv\.lock/, /TestPermis_Desktop\.zip/,
  /sw\.js/, /workbox/, /manifest\.json/, /make-zip\.js/,
  /BUILD_PORTABLE\.bat/, /INSTALLER\.bat/, /UPDATE_FROM_GITHUB\.bat/,
  /README_BUILD\.txt/,
];

function shouldExclude(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const excl of excludePatterns) {
    if (excl.test(normalized)) return true;
  }
  return false;
}

function addDirToZip(zip, dirPath, zipPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(zipPath, entry.name).replace(/\\/g, '/');
    if (shouldExclude(relPath)) continue;
    if (entry.isDirectory()) {
      addDirToZip(zip, fullPath, relPath);
    } else {
      zip.addLocalFile(fullPath, path.dirname(relPath).replace(/\\/g, '/'), entry.name);
      const size = fs.statSync(fullPath).size;
      console.log(`  + ${relPath} (${(size / 1024).toFixed(1)} KB)`);
    }
  }
}

console.log('Creating TestPermis_Desktop.zip...\n');
let fileCount = 0;

for (const item of includes) {
  const fullPath = path.join(root, item);
  if (!fs.existsSync(fullPath)) { console.log(`  SKIP: ${item}`); continue; }
  if (fs.statSync(fullPath).isDirectory()) {
    addDirToZip(zip, fullPath, item);
  } else {
    if (!shouldExclude(item)) {
      zip.addLocalFile(fullPath, '', path.basename(item));
      fileCount++;
      console.log(`  + ${item}`);
    }
  }
}

zip.writeZip(outputPath);
const stats = fs.statSync(outputPath);
console.log(`\n✅ ZIP créé: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
