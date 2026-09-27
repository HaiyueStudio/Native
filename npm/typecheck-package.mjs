import { cpSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(process.argv[2] ?? here);
const scratch = mkdtempSync(path.join(tmpdir(), 'native-package-typecheck-'));
try {
  // Use normal package exports resolution, independent of the staging location.
  for (const file of ['index.ts', 'bridge']) cpSync(path.join(packageRoot, file), path.join(scratch, file), { recursive: true });
  symlinkSync(path.join(here, 'node_modules'), path.join(scratch, 'node_modules'), 'dir');
  const config = path.join(scratch, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({
    extends: path.join(here, 'tsconfig.json'),
    include: [path.join(scratch, 'index.ts'), path.join(scratch, 'bridge/**/*.ts')],
    exclude: [path.join(scratch, 'node_modules')],
  }));
  execFileSync(process.execPath, [path.join(here, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', config], { stdio: 'inherit' });
} finally { rmSync(scratch, { recursive: true, force: true }); }
