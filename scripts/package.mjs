import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const archiveName = `mindgit-v${packageJson.version}.zip`;
const archivePath = join(rootDir, archiveName);
const sourcePaths = ['assets', 'src', 'manifest.json', 'README.md'];

if (existsSync(archivePath)) {
  rmSync(archivePath);
}

try {
  execFileSync('zip', ['-r', archiveName, ...sourcePaths, '-x', '*.git*'], {
    cwd: rootDir,
    stdio: 'inherit'
  });
} catch (error) {
  if (process.platform !== 'win32' || error?.code !== 'ENOENT') {
    throw error;
  }

  const destination = archivePath.replaceAll("'", "''");
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Compress-Archive -Path ${sourcePaths.join(',')} -DestinationPath '${destination}' -Force`
    ],
    { cwd: rootDir, stdio: 'inherit' }
  );
}

console.log(`Packaged ${archivePath}`);
