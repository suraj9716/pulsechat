import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join('dist', 'frontend', 'browser');
const indexPath = path.join(outDir, 'index.html');
const fallbackPath = path.join(outDir, '404.html');

if (!fs.existsSync(indexPath)) {
  console.error('Missing index.html for SPA fallback:', indexPath);
  process.exit(1);
}

fs.copyFileSync(indexPath, fallbackPath);
console.log('SPA fallback: copied index.html -> 404.html');
