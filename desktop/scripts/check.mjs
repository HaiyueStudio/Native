import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tools = JSON.parse(readFileSync(resolve(root, 'build/tools.json'), 'utf8'));
const result = spawnSync(tools.deno, ['check', '--unstable-sloppy-imports', '--config', 'deno-check.json', 'sample/main.ts'],
  { cwd: root, env: { ...process.env, DENO_DIR: tools.denoCache }, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
