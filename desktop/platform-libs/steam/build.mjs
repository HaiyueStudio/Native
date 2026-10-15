import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const here = dirname(fileURLToPath(import.meta.url));
const sdk = process.env.STEAMWORKS_SDK, version = process.env.STEAMWORKS_SDK_VERSION;
if (!sdk || !version) throw new Error('Set STEAMWORKS_SDK to the licensed SDK root and STEAMWORKS_SDK_VERSION to its exact version. SDK is not bundled.');
const out = resolve(here, '../../build/steam'); mkdirSync(out, { recursive: true });
const win = process.platform === 'win32'; if (!win && process.platform !== 'darwin') throw new Error('Only Windows/macOS targets are supported');
const runtime = resolve(sdk, win ? 'redistributable_bin/win64/steam_api64.dll' : 'redistributable_bin/osx/libsteam_api.dylib');
const link = win ? resolve(sdk, 'redistributable_bin/win64/steam_api64.lib') : runtime;
const name = win ? 'haiyue_steam.dll' : 'libhaiyue_steam.dylib';
execFileSync(win ? 'cl' : 'c++', win ? ['/nologo', '/O2', '/EHsc', '/MT', '/LD', `/I${resolve(sdk, 'public')}`, resolve(here, 'steam.cpp'), link, '/link', `/OUT:${resolve(out, name)}`] :
  ['-std=c++17', '-O2', '-mmacosx-version-min=12.0', '-dynamiclib', '-fvisibility=hidden', '-I', resolve(sdk, 'public'), resolve(here, 'steam.cpp'), link, '-Wl,-rpath,@loader_path', '-o', resolve(out, name)], { cwd: out, stdio: 'inherit' });
copyFileSync(runtime, resolve(out, win ? 'steam_api64.dll' : 'libsteam_api.dylib'));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
writeFileSync(resolve(out, 'sdk-lock.json'), JSON.stringify({ abi: 1, sdkVersion: version, target: `${process.platform}-${process.arch}`, headers: ['steam_api.h', 'isteamuserstats.h', 'steam_api_common.h'].map(name => ({ name, sha256: hash(resolve(sdk, 'public/steam', name)) })), runtimeSha256: hash(runtime), librarySha256: hash(resolve(out, name)), acceptance: 'pending-real-client' }, null, 2) + '\n');
