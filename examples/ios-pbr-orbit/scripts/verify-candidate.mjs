import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('..', import.meta.url));
const native = resolve(app, '../..');
const candidatePath = resolve(app, process.argv[2] ?? 'vendor/g04-native-candidate.json');
const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
let checked = 0;
for (const [root, files] of [
  [native, candidate.sourceFiles],
  [resolve(app, candidate.appPath), candidate.builtFiles],
  [resolve(app, candidate.evidencePath ?? 'evidence/g03'), candidate.evidenceFiles],
  [app, candidate.artifactFiles ?? {}],
]) {
  for (const [path, expected] of Object.entries(files)) {
    if (hash(resolve(root, path)) !== expected) throw new Error(`Candidate mismatch: ${path}`);
    checked++;
  }
}
const binding = candidate.effectiveCanvasBinding;
if (hash(resolve(app, binding.path)) !== binding.sha256) throw new Error('Effective Canvas binding mismatch');
console.log(JSON.stringify({ status: 'passed', candidate: candidatePath.slice(dirname(candidatePath).length + 1), checkedFiles: checked + 1, appMachOUuid: candidate.appMachOUuid }));
