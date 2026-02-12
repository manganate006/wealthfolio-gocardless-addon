import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { createReadStream } from 'fs';
import archiver from 'archiver';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

const output = createWriteStream(join(rootDir, 'gocardless-bank-sync.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Created gocardless-bank-sync.zip (${archive.pointer()} bytes)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add manifest
archive.file(join(rootDir, 'manifest.json'), { name: 'manifest.json' });

// Add built addon
archive.file(join(distDir, 'addon.js'), { name: 'addon.js' });

archive.finalize();
