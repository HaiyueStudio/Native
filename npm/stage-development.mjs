// A private, source-only preview; does not rewrite published 0.1.0 or its frozen evidence.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBridgePackageFile } from './package-files.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here), output = path.join(root, 'artifacts/native-development-package');
const candidates = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0');
rmSync(output, { recursive: true, force: true }); mkdirSync(output, { recursive: true });
const files = {};
for (const file of new Set(candidates.filter(isBridgePackageFile))) {
  const destination = path.join(output, file);
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(path.join(root, file), destination);
  files[file] = createHash('sha256').update(readFileSync(destination)).digest('hex');
}
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json')));
pkg.private = true; pkg.version += '-development.0'; delete pkg.scripts;
writeFileSync(path.join(output, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
for (const file of ['index.ts', 'README.md', 'tsconfig.json']) cpSync(path.join(here, file), path.join(output, file));
cpSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
writeFileSync(path.join(output, 'provenance.json'), JSON.stringify({ development: true, files }, null, 2) + '\n');
console.log(output);
