import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, verifyCandidate } from '../scripts/release/common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json')));
const sourcePkg = JSON.parse(readFileSync(path.join(root, 'package.json')));
const candidate = verifyCandidate();
if (pkg.name !== sourcePkg.name || pkg.version !== sourcePkg.version || pkg.version !== candidate.candidate)
  throw new Error('npm and frozen source identities must match');
const sourceTag = `native-v${pkg.version}`;
const manifest = readFileSync(path.join(root, 'release/candidate.json'));
const tagged = execFileSync('git', ['show', `${sourceTag}:release/candidate.json`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
if (!tagged.equals(manifest)) throw new Error('Frozen source differs from the published source tag');
const files = {};
// Rebuild the generated package tree, never copy games, examples or native build outputs.
rmSync(path.join(here, 'bridge'), { recursive: true, force: true });
rmSync(path.join(here, 'dist'), { recursive: true, force: true });
for (const [input, sha256] of Object.entries(candidate.files)) {
  const file = input.slice('Native/'.length);
  if (!file.startsWith('bridge/') || !(/\.(?:ts|swift|java)$/.test(file)
    || file === 'bridge/branding/webpack.cjs' || file === 'bridge/branding/assets/haiyue-moon.png')) continue;
  const destination = path.join(here, file);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(root, file), destination);
  files[file] = sha256;
}
writeFileSync(path.join(here, 'provenance.json'), JSON.stringify({
  name: pkg.name, version: pkg.version, sourceTag,
  sourceCommit: execFileSync('git', ['rev-parse', `${sourceTag}^{}`], { cwd: root, encoding: 'utf8' }).trim(),
  manifestSha256: createHash('sha256').update(manifest).digest('hex'), files,
}, null, 2) + '\n');
copyFileSync(path.join(root, 'LICENSE'), path.join(here, 'LICENSE'));
console.log(`Prepared ${pkg.name}@${pkg.version}: ${Object.keys(files).length} reusable native files, no examples or games`);
