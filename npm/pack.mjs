import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
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
const manifestBytes = readFileSync(path.join(root, 'release/candidate.json'));
const taggedManifest = execFileSync('git', ['show', `${sourceTag}:release/candidate.json`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
if (!taggedManifest.equals(manifestBytes)) throw new Error('Frozen source differs from the published source tag');
const sourceCommit = execFileSync('git', ['rev-parse', `${sourceTag}^{}`], { cwd: root, encoding: 'utf8' }).trim();
const temp = mkdtempSync(path.join(tmpdir(), 'haiyue-npm-source-'));
try {
  const inputs = [...Object.keys(candidate.files).map(file => file.slice('Native/'.length)), 'release/candidate.json'];
  for (const file of inputs) {
    const destination = path.join(temp, file);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(root, file), destination);
  }
  mkdirSync(path.join(here, 'dist'), { recursive: true });
  const archive = path.join(here, 'dist/source.tar.gz');
  execFileSync('tar', ['-czf', archive, '-C', temp, '.'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  writeFileSync(path.join(here, 'dist/source.json'), JSON.stringify({
    name: pkg.name, version: pkg.version, sourceTag, sourceCommit,
    frozenInputCount: Object.keys(candidate.files).length,
    archiveSha256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
    manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
  }, null, 2) + '\n');
  copyFileSync(path.join(root, 'LICENSE'), path.join(here, 'LICENSE'));
  console.log(`Prepared ${pkg.name}@${pkg.version}: ${inputs.length} source files`);
} finally { rmSync(temp, { recursive: true, force: true }); }
