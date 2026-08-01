import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('dist', 'frontend', 'browser');
const indexPath = path.join(outDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('Build output missing:', indexPath);
  process.exit(1);
}

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const referenced = new Set();

for (const match of indexHtml.matchAll(/(?:href|src)="([^"]+\.js)"/g)) {
  referenced.add(match[1]);
}

for (const file of fs.readdirSync(outDir)) {
  if (file.startsWith('main-') && file.endsWith('.js')) {
    const mainJs = fs.readFileSync(path.join(outDir, file), 'utf8');
    for (const match of mainJs.matchAll(/import\("\.\/(chunk-[^"]+\.js)"\)/g)) {
      referenced.add(match[1]);
    }
  }
}

const missing = [...referenced].filter((file) => !fs.existsSync(path.join(outDir, file)));
if (missing.length > 0) {
  console.error('Build verification failed. Missing files:', missing.join(', '));
  process.exit(1);
}

console.log(`Build OK: ${referenced.size} referenced JS files present in ${outDir}`);
