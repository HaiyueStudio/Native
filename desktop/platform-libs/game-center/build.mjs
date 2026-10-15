import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../..'), out = resolve(root, 'desktop/build');
if (process.platform !== 'darwin') throw new Error('GameKit requires Xcode on macOS');
mkdirSync(out, { recursive: true });
execFileSync('xcrun', ['swiftc', '-module-cache-path', resolve(out, 'swift-cache'), '-swift-version', '5', '-emit-library', '-O', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx12.0`,
  resolve(root, 'bridge/achievements/game-center/native/HYGameCenter.swift'), resolve(here, 'ffi.swift'), '-framework', 'GameKit', '-framework', 'AppKit',
  '-o', resolve(out, 'libhaiyue_game_center.dylib')], { stdio: 'inherit' });
