import { readFileSync, mkdtempSync, cpSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = `${process.platform}-${process.arch}`;
const metadata = JSON.parse(readFileSync(resolve(root, 'build/package', target, 'package.json'), 'utf8'));
const install = mkdtempSync(join(tmpdir(), 'haiyue-desktop-player-'));
const app = join(install, basename(metadata.app)); cpSync(metadata.app, app, { recursive: true });
const executable = process.platform === 'darwin' ? join(app, 'Contents/MacOS/haiyue-rubik') : join(app, 'haiyue-rubik.exe');
const env = { ...process.env, DENO_DIR: join(install, 'runtime-cache') };
// Windows env names are case-insensitive; avoid leaving an inherited mixed-case Path.
for (const name of Object.keys(env)) if (name.toLowerCase() === 'path') delete env[name];
env.PATH = process.platform === 'win32' ? `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` : '/usr/bin:/bin';
const result = spawnSync(executable, ['--focus-window=1', '--probes=1', '--exercise=1', '--frames=420', '--seconds=120',
  `--data=${join(install, 'profile')}`], { cwd: install, env, encoding: 'utf8', timeout: 180000, maxBuffer: 10 * 1024 * 1024 });
const log = (result.stdout ?? '') + (result.stderr ?? '');
writeFileSync(resolve(root, 'build/standalone.jsonl'), log); process.stdout.write(log);
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Standalone app failed: ${result.status}`);
const records = log.split('\n').filter(s => s.startsWith('{')).map(s => JSON.parse(s));
const ready = records.find(r => r.kind === 'ready'), complete = records.find(r => r.kind === 'complete'), probes = records.find(r => r.kind === 'probes');
if (!ready?.data.os.standalone || ready.data.document || complete?.data.frames !== 420 || probes?.data.audio !== 'device-playback-api-passed') throw new Error('Incomplete independent package validation');
writeFileSync(resolve(root, 'build/standalone-summary.json'), JSON.stringify({ install, executableSha256: metadata.sha256, bundleSha256: metadata.bundleSha256, noDevelopmentRuntimeInPath: true, status: 'passed' }, null, 2) + '\n');
console.log('Independent package validation passed');
