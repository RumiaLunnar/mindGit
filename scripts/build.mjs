import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const sourceDir = join(rootDir, 'src');
const manifestPath = join(rootDir, 'manifest.json');

function collectJavaScriptFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(entryPath);
    }
  }

  return files;
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3) {
  throw new Error('MindGit requires a Manifest V3 extension manifest.');
}

const serviceWorkerPath = join(rootDir, manifest.background?.service_worker || '');
const popupPath = join(rootDir, manifest.action?.default_popup || '');
if (!readFileSync(serviceWorkerPath, 'utf8') || !readFileSync(popupPath, 'utf8')) {
  throw new Error('Manifest points to a missing background or popup entry.');
}

const sourceFiles = collectJavaScriptFiles(sourceDir);
for (const file of sourceFiles) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`Build check passed: Manifest V3 + ${sourceFiles.length} JavaScript files.`);
