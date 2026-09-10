import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/haptics.ios.ts', import.meta.url), 'utf8');
const moduleSource = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText;
const { RangeHaptics } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
test('recoil follows 10 Hz shots; hits override recoil; suspension cancels feedback', () => {
  let now = 0; const impacts = [];
  globalThis.NSProcessInfo = { processInfo: { get systemUptime() { return now / 1000; } } };
  globalThis.UIImpactFeedbackStyle = { Light: 0, Medium: 1 };
  globalThis.UIImpactFeedbackGenerator = { alloc: () => ({ initWithStyle: style => ({ prepare() {}, impactOccurred() { impacts.push(style); } }) }) };
  try {
    const feedback = new RangeHaptics(); feedback.resume();
    for (let i = 0; i < 10; i++) { now = i * 100; feedback.impact('shot'); }
    assert.equal(feedback.snapshot().recoilPulses, 10);
    feedback.impact('hit'); assert.equal(impacts.at(-1), 1);
    now += 100; feedback.impact('shot'); assert.equal(impacts.length, 11);
    now += 100; feedback.impact('shot'); assert.equal(impacts.length, 12);
    feedback.suspend(); now += 1000; feedback.impact('hit'); feedback.impact('shot'); assert.equal(impacts.length, 12);
    feedback.resume(); feedback.impact('hit'); assert.equal(impacts.length, 13);
    feedback.dispose(); feedback.impact('hit'); assert.equal(impacts.length, 13);
  } finally { delete globalThis.NSProcessInfo; delete globalThis.UIImpactFeedbackStyle; delete globalThis.UIImpactFeedbackGenerator; }
});
