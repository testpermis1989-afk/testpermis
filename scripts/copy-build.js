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
const staticSource = path.join(root, '.next', 'static');
const publicSource = path.join(root, 'public');

console.log('Copying .next/static to .next/standalone/.next/static ...');
copyRecursiveSync(staticSource, standaloneStatic);
console.log('Done.');

console.log('Copying public to .next/standalone/public ...');
copyRecursiveSync(publicSource, standalonePublic);
console.log('Done.');

console.log('Build post-process complete!');
