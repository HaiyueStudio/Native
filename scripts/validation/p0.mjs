import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(['--test', 'test/achievements-core.test.mjs', 'test/desktop-host.test.mjs', 'test/desktop-storage.test.mjs']);
run(['scripts/validation/achievements-core.mjs']);
if (process.argv.includes('--desktop')) run(['desktop/scripts/verify.mjs']);
console.log('P0 automated checks passed; consult desktop/WINDOWS-HANDOFF.md for hardware acceptance.');
