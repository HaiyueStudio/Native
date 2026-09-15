import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../../../bridge/lifecycle/frame-performance.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText;
const { FramePerformance } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('performance sampling separates frame intervals and work, excludes background suspension', () => {
  const samples = new FramePerformance();
  samples.begin(0); samples.end(4); samples.begin(16); samples.end(22);
  assert.deepEqual(samples.take(), { cpu: { samples: 2, meanMs: 5, p95Ms: 6 }, interval: { samples: 1, meanMs: 16, p95Ms: 16 } });
  samples.reset(); samples.begin(10000); samples.end(10004);
  assert.equal(samples.take().interval.samples, 0);
});

test('missing report callbacks cannot accumulate unbounded performance samples', () => {
  const samples = new FramePerformance();
  for (let i = 0; i < 10000; i++) { samples.begin(i * 16); samples.end(i * 16 + 4); }
  const result = samples.take();
  assert.equal(result.cpu.samples, 600); assert.equal(result.interval.samples, 600);
  assert.equal(samples.take().cpu.samples, 0);
});
