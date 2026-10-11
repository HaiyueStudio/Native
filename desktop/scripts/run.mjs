import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tools = JSON.parse(readFileSync(resolve(root, 'build/tools.json'), 'utf8'));
const audio = resolve(root, 'build', process.platform === 'win32' ? 'haiyue_audio.dll' : 'libhaiyue_audio.dylib');
const args = ['run', '--config', resolve(root, 'deno.json'), '--unstable-webgpu', '--allow-ffi', '--allow-read', '--allow-write', '--allow-env', '--allow-sys=homedir',
  resolve(root, 'build/main.js'), `--glfw=${tools.glfw}`, `--font=${tools.font}`, ...(existsSync(audio) ? [`--audio=${audio}`] : []), ...process.argv.slice(2)];
const result = spawnSync(tools.deno, args, { cwd: root, env: { ...process.env, DENO_DIR: tools.denoCache }, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
