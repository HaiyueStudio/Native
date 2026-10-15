import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const script of ['check.mjs', 'bundle.mjs']) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts', script)], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const result = spawnSync(process.execPath, [resolve(root, 'scripts/run.mjs'), '--focus-window=1', '--probes=1', '--exercise=1', '--frames=420', '--seconds=120',
  `--data=${resolve(root, 'build/validation-profile')}`, `--capture=${resolve(root, 'build/validation.png')}`],
  { cwd: root, encoding: 'utf8', timeout: 150000, maxBuffer: 10 * 1024 * 1024 });
const log = (result.stdout ?? '') + (result.stderr ?? '');
writeFileSync(resolve(root, 'build/validation.jsonl'), log); process.stdout.write(log);
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Desktop process failed: ${result.status}`);
const events = log.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
const complete = events.find(e => e.kind === 'complete'), probes = events.find(e => e.kind === 'probes');
if (complete?.data.frames !== 420 || probes?.data.audio !== 'device-playback-api-passed') throw new Error('Incomplete desktop validation');
console.log('Desktop automated validation passed. Physical input, target devices and long soak remain separate gates.');
