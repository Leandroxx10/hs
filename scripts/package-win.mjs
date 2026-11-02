import { packager } from '@electron/packager';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'node:fs';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'release');
await mkdir(output, { recursive: true });
const dirs = await packager({ dir: root, out: output, name: 'HS Studio', executableName: 'HS Studio',
  platform: 'win32', arch: 'x64', electronVersion: pkg.devDependencies.electron,
  icon: path.join(root, 'assets', 'icon.ico'), appVersion: pkg.version,
  overwrite: true, prune: false,
  ignore: [/^\/(?:node_modules|release|src|scripts|tests|\.git|\.local)(?:\/|$)/,
    /^\/(?:package-lock\.json|tsconfig\.json|vite\.config\.ts|index\.html|\.gitignore)$/],
});
const destination = path.join(output, `HS-Studio-${pkg.version}-Windows-x64.zip`);
await copyFile(path.join(root, 'LEIA-ME-WINDOWS.txt'), path.join(dirs[0], 'LEIA-ME-WINDOWS.txt'));
await copyFile(path.join(root, 'README.md'), path.join(dirs[0], 'README.md'));
await copyFile(path.join(root, 'VALIDATION.md'), path.join(dirs[0], 'VALIDATION.md'));
await copyFile(path.join(root, 'LICENSE'), path.join(dirs[0], 'LICENSE-HS-Studio.txt'));
await new Promise((resolve, reject) => {
  const stream = createWriteStream(destination);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  stream.on('close', resolve); stream.on('error', reject); archive.on('error', reject);
  archive.pipe(stream); archive.directory(dirs[0], 'HS Studio'); archive.finalize();
});
console.log(`Pacote criado: ${destination}`);
