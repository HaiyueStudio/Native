import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tools = JSON.parse(readFileSync(resolve(root, 'build/tools.json'), 'utf8'));
const mac = process.platform === 'darwin';
const output = resolve(root, 'build/package', tools.target);
const app = mac ? resolve(output, 'Haiyue Rubik.app') : resolve(output, 'Haiyue Rubik');
const executableDir = mac ? resolve(app, 'Contents/MacOS') : app;
const assets = resolve(executableDir, 'assets');
const audio = resolve(root, 'build', mac ? 'libhaiyue_audio.dylib' : 'haiyue_audio.dll');
if (!existsSync(audio)) throw new Error('Run npm run build:audio first');
mkdirSync(assets, { recursive: true });
for (const file of [tools.glfw, tools.font, audio]) copyFileSync(file, resolve(assets, basename(file)));
const licenses = resolve(assets, 'licenses'); mkdirSync(licenses, { recursive: true });
cpSync(resolve(root, 'licenses'), licenses, { recursive: true });
copyFileSync(tools.fontLicense, resolve(licenses, 'Noto-OFL.txt'));
copyFileSync(resolve(root, 'node_modules/@napi-rs/canvas/LICENSE'), resolve(licenses, 'napi-canvas-MIT.txt'));
copyFileSync(resolve(root, 'node_modules/@haiyue/engine/LICENSE'), resolve(licenses, 'Engine-MIT.txt'));
copyFileSync(resolve(root, 'node_modules/@haiyue/extensions/LICENSE'), resolve(licenses, 'Extensions-MIT.txt'));
copyFileSync(resolve(root, 'node_modules/wgpu-matrix/LICENSE.md'), resolve(licenses, 'wgpu-matrix-MIT.txt'));
copyFileSync(resolve(root, '../LICENSE'), resolve(licenses, 'Haiyue-MIT.txt'));
const executable = resolve(executableDir, mac ? 'haiyue-rubik' : 'haiyue-rubik.exe');
// Isolated runtime tree: do not embed the build tools or the Engine dependency tree a second time.
const stage = resolve(root, 'build/compile');
mkdirSync(resolve(stage, 'node_modules/@napi-rs'), { recursive: true });
const binaryPackage = `canvas-${mac ? `darwin-${process.arch}` : 'win32-x64-msvc'}`;
for (const name of ['canvas', binaryPackage]) cpSync(resolve(root, 'node_modules/@napi-rs', name), resolve(stage, 'node_modules/@napi-rs', name), { recursive: true });
copyFileSync(resolve(root, 'build/main.js'), resolve(stage, 'main.js'));
writeFileSync(resolve(stage, 'package.json'), JSON.stringify({ type: 'module', private: true, dependencies: { '@napi-rs/canvas': '1.0.7' } }));
copyFileSync(resolve(root, 'deno.json'), resolve(stage, 'deno.json'));
// Source type checking runs before bundling; this isolated stage contains runtime dependencies only.
execFileSync(tools.deno, ['compile', '--no-check', '--config', 'deno.json', '--unstable-webgpu', '--allow-ffi', '--allow-read', '--allow-write', '--allow-env', '--allow-sys=homedir',
  '--app-name', 'org.haiyue.desktop.rubik', '--output', executable, 'main.js'],
  { cwd: stage, env: { ...process.env, DENO_DIR: tools.denoCache }, stdio: 'inherit' });
if (mac) {
  writeFileSync(resolve(app, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>haiyue-rubik</string><key>CFBundleIdentifier</key><string>org.haiyue.desktop.rubik</string>
<key>CFBundleName</key><string>Haiyue Rubik</string><key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.2.0</string><key>CFBundleVersion</key><string>1</string>
<key>NSHighResolutionCapable</key><true/><key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>`);
  // Local development signing only. Distribution signing/notarization belongs to release G07.
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
}
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const evidence = { target: tools.target, app, executable, sha256: sha(executable), bundleSha256: sha(resolve(root, 'build/main.js')),
  toolchainSha256: sha(resolve(root, 'toolchains.json')), developmentSignatureOnly: true, builtAt: new Date().toISOString() };
writeFileSync(resolve(output, 'package.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
