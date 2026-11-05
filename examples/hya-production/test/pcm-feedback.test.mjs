import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {GuiButton, GuiRoot} from '@haiyue/engine/gui';

// Run the actual page's probe callback against public GUI controls. Only the
// device PCM promise/audio boundary is controlled; this is not a device probe.
const source = readFileSync(new URL('../src/main-page.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('main-page.ts', source, ts.ScriptTarget.Latest, true);
let initializer;
function find(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'probeButton') initializer = node.initializer;
  ts.forEachChild(node, find);
}
find(parsed);
assert.ok(initializer, 'The real page must expose its PCM button declaration.');
const factorySource = ts.transpileModule(`
  let probing=false, pendingJobs=0, disposed=false;
  const probeButton=${initializer.getText(parsed)};
  return probeButton;
`, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None}}).outputText;
const createButton = new Function('GuiButton', 'action', 'playbackUnlock', 'player', 'audio', 'status', 'probeIosNativePcm', 'record', 'abort', 'host', 'finishCleanup', factorySource);
function setup() {
  const root = new GuiRoot(), player = {status: 'running'}, errors = [];
  let settle, fail, action, wakeups = 0, invalidations = 0;
  const probe = new Promise((resolve, reject) => {settle = resolve; fail = reject;});
  const host = {requestFrame() {wakeups++;}};
  root.onInvalidation(() => {invalidations++; host.requestFrame();});
  const button = root.add(createButton(GuiButton, (_name, run) => {action = run().catch(error => errors.push(error));},
    {pause(current) {current.status = 'paused';}}, player, {suspend() {}}, () => {}, () => probe, () => {},
    new AbortController(), host, () => {}));
  root.layout(390, 844); root.clearDirty();
  const click = () => button.onClick({});
  const present = () => {const text = button.text; root.clearDirty(); return text;};
  return {root, button, player, errors, click, present, settle, fail, get action() {return action;}, get wakeups() {return wakeups;}, get invalidations() {return invalidations;}};
}
test('async PCM completion invalidates the paused GUI after Running has already been presented', async () => {
  const h = setup();
  try {
    h.click(); assert.equal(h.player.status, 'paused');
    assert.equal(h.present(), 'Running PCM…');
    const before = h.invalidations, wakeups = h.wakeups;
    h.settle({cases: Array.from({length: 7}, () => ({passed: true}))}); await h.action;
    assert.equal(h.button.text, 'PCM 7/7 passed · tap Unlock');
    assert.equal(h.root.dirty, true, 'Completed text must invalidate the retained GUI paint, not only request a frame');
    assert.ok(h.invalidations > before); assert.ok(h.wakeups > wakeups);
    assert.equal(h.player.status, 'paused'); assert.deepEqual(h.errors, []);
    assert.equal(h.present(), 'PCM 7/7 passed · tap Unlock');
  } finally {h.root.destroy();}
});
test('async PCM failure also repaints its result while playback stays paused', async () => {
  const h = setup();
  try {
    h.click(); h.present(); const before = h.invalidations;
    h.fail(new Error('Device probe unavailable')); await h.action;
    assert.equal(h.button.text, 'PCM failed · see status');
    assert.equal(h.root.dirty, true); assert.ok(h.invalidations > before);
    assert.equal(h.errors[0].message, 'Device probe unavailable'); assert.equal(h.player.status, 'paused');
  } finally {h.root.destroy();}
});
