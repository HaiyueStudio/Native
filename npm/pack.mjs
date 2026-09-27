import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { isBridgePackageFile } from './package-files.mjs';
import { root, verifyCandidate } from '../scripts/release/common.mjs';

const { values } = parseArgs({ options: { candidate: { type: 'boolean', default: false }, output: { type: 'string' } } });
const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json')));
const sourcePkg = JSON.parse(readFileSync(path.join(root, 'package.json')));
const candidate = verifyCandidate();
if (pkg.name !== sourcePkg.name || pkg.version !== sourcePkg.version || pkg.version !== candidate.candidate)
  throw new Error('npm and frozen source identities must match');
const sourceTag = `native-v${pkg.version}`;
const manifest = readFileSync(path.join(root, 'release/candidate.json'));
let sourceCommit = null;
let output = here;
if (values.candidate) {
  if (!values.output) throw new Error('Candidate preparation requires --output to a new directory');
  output = path.resolve(values.output);
  if (existsSync(output)) throw new Error('Candidate output must be a new directory');
  mkdirSync(output, { recursive: true });
  for (const file of ['index.ts', 'README.md']) copyFileSync(path.join(here, file), path.join(output, file));
  // Candidate checks do not require or create a release tag and cannot publish by accident.
  writeFileSync(path.join(output, 'package.json'), JSON.stringify({ ...pkg, private: true }, null, 2) + '\n');
} else {
  if (values.output) throw new Error('--output is only supported for private candidates');
  const tagged = execFileSync('git', ['show', `${sourceTag}:release/candidate.json`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  if (!tagged.equals(manifest)) throw new Error('Frozen source differs from the published source tag');
  sourceCommit = execFileSync('git', ['rev-parse', `${sourceTag}^{}`], { cwd: root, encoding: 'utf8' }).trim();
}
const files = {};
rmSync(path.join(output, 'bridge'), { recursive: true, force: true });
rmSync(path.join(output, 'dist'), { recursive: true, force: true });
for (const [input, sha256] of Object.entries(candidate.files)) {
  const file = input.slice('Native/'.length);
  if (!isBridgePackageFile(file)) continue;
  const destination = path.join(output, file);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(root, file), destination);
  files[file] = sha256;
}
writeFileSync(path.join(output, 'provenance.json'), JSON.stringify({
  name: pkg.name, version: pkg.version, candidateOnly: values.candidate,
  sourceTag: values.candidate ? null : sourceTag, sourceCommit,
  manifestSha256: createHash('sha256').update(manifest).digest('hex'), files,
}, null, 2) + '\n');
copyFileSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
console.log(`Prepared ${pkg.name}@${pkg.version}: ${Object.keys(files).length} reusable native files at ${output}`);
