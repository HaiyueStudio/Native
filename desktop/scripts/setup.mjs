import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(resolve(root, 'toolchains.json'), 'utf8'));
const target = `${process.platform}-${process.arch}`, config = lock.targets[target];
if (!config) throw new Error(`Unsupported target: ${target}`);
const cache = resolve(root, '../artifacts/desktop-tools', target), shared = resolve(root, '../artifacts/desktop-tools/shared');
mkdirSync(cache, { recursive: true }); mkdirSync(shared, { recursive: true }); mkdirSync(resolve(root, 'build'), { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function download(url, destination, expected) {
  if (existsSync(destination)) {
    if (sha(readFileSync(destination)) !== expected) throw new Error(`Checksum mismatch: ${destination}`);
    return;
  }
  console.log(`Download ${url}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha(bytes) !== expected) throw new Error(`Downloaded checksum mismatch: ${url}`);
  const temp = `${destination}.download`; writeFileSync(temp, bytes); renameSync(temp, destination);
}
function unzip(archive, output) {
  mkdirSync(output, { recursive: true });
  if (process.platform === 'win32') execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(root, 'scripts/unzip.ps1'), '-Archive', archive, '-Destination', output], { stdio: 'inherit' });
  else execFileSync('/usr/bin/unzip', ['-o', archive, '-d', output], { stdio: 'ignore' });
}
if (sha(readFileSync(resolve(root, lock.engine.file))) !== lock.engine.sha256) throw new Error('Engine tarball checksum mismatch');
if (sha(readFileSync(resolve(root, lock.extensions.file))) !== lock.extensions.sha256) throw new Error('Extensions tarball checksum mismatch');
await download(`https://github.com/denoland/deno/releases/download/v${lock.denoVersion}/deno-${config.denoTarget}.zip`, resolve(cache, 'deno.zip'), config.denoSha256);
await download(`https://github.com/glfw/glfw/releases/download/${lock.glfwVersion}/${config.glfwArchive}`, resolve(cache, 'glfw.zip'), config.glfwSha256);
unzip(resolve(cache, 'deno.zip'), resolve(cache, 'deno'));
unzip(resolve(cache, 'glfw.zip'), resolve(cache, 'glfw'));
const assets = {};
for (const [key, asset] of Object.entries(lock.assets)) {
  const destination = resolve(shared, asset.file); await download(asset.url, destination, asset.sha256); assets[key] = destination;
}
const deno = resolve(cache, 'deno', process.platform === 'win32' ? 'deno.exe' : 'deno');
if (process.platform !== 'win32') chmodSync(deno, 0o755);
const glfw = resolve(cache, 'glfw', config.glfwLibrary);
if (!existsSync(glfw)) throw new Error(`GLFW library not found: ${glfw}`);
const version = execFileSync(deno, ['--version'], { encoding: 'utf8' });
if (!version.startsWith(`deno ${lock.denoVersion} `)) throw new Error('Unexpected Deno runtime');
writeFileSync(resolve(root, 'build/tools.json'), JSON.stringify({ target, deno, glfw, ...assets, denoCache: resolve(cache, 'deno-cache') }, null, 2) + '\n');
console.log(`Desktop tools ready: ${target}`);
