import { mkdirSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { root, manifestPath, verifyCandidate, command } from './common.mjs';

try {
  const { values } = parseArgs({ options: { output: { type: 'string' } } });
  if (!values.output) throw new Error('Usage: npm run release:export -- --output /absolute/new-checkout');
  const output = path.resolve(values.output);
  if (existsSync(output)) throw new Error('Output must be a new directory. Nothing is overwritten.');
  const candidate = verifyCandidate();
  const inputs = Object.keys(candidate.files).map(file => file.slice('Native/'.length));
  mkdirSync(output, { recursive: true });
  for (const file of [...inputs, path.relative(root, manifestPath)]) {
    const target = path.join(output, file);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(root, file), target);
  }
  // The verifier enumerates tracked + nonignored inputs. No original .git,
  // node_modules, platforms, credentials, local models or generated assets are copied.
  command('git', ['init', '-q'], output);
  mkdirSync(path.join(output, 'artifacts'), { recursive: true });
  writeFileSync(path.join(output, 'artifacts/clean-export.json'), JSON.stringify({
    candidate: candidate.candidate, inputCount: inputs.length,
    exportedAt: new Date().toISOString(),
    method: 'Copy verified frozen public inputs into a new standalone Git working directory.',
  }, null, 2) + '\n');
  console.log(output);
} catch (error) { console.error(error.message); process.exitCode = 1; }
