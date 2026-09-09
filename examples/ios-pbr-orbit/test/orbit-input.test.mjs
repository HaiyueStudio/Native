import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { OrbitControl, SphericalTransform3D } from '@haiyue/engine';

async function loadTs(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { OrbitPointerTarget } = await loadTs('../../../bridge/input/pointer-target.ts');
const { TouchIdentity } = await loadTs('../../../bridge/input/touch-identity.ts');
const point = (id, x, y) => ({ id, x, y });
function setup(dpr = 2, origin = { x: 17, y: 59 }) {
  const rect = { ...origin, width: 430, height: 839 };
  const target = new OrbitPointerTarget(() => rect);
  target.width = rect.width * dpr;
  target.height = rect.height * dpr;
  const camera = new SphericalTransform3D({ radius: 6, theta: Math.PI / 4, phi: Math.PI / 3, target: [0, 0, 0] });
  const orbit = new OrbitControl(target, camera, { enableRotate: true, enablePan: false, enableZoom: false, minPhi: .1, maxPhi: Math.PI - .1 });
  return { target, camera, orbit, state: () => [camera.theta, camera.phi, camera.radius, ...camera.target] };
}
function drag(s, end = point(1, 160, 280)) {
  s.target.handle('down', [point(1, 100, 200)]);
  s.target.handle('move', [end]);
  s.target.handle('up', [end]);
}

test('packed production OrbitControl gives identical logical drag at different DPR and safe-area origins', () => {
  const a = setup(1, { x: 0, y: 0 }), b = setup(2), c = setup(3, { x: 30, y: 100 });
  for (const s of [a, b, c]) drag(s);
  assert.deepEqual(a.state(), b.state());
  assert.deepEqual(a.state(), c.state());
  assert.ok(a.camera.theta < Math.PI / 4 && a.camera.phi < Math.PI / 3);
  assert.deepEqual(a.state().slice(2), [6, 0, 0, 0]);
});

test('up, cancel and suspend stop Orbit; stale moves cannot resume the drag', () => {
  for (const end of ['up', 'cancel', 'suspend']) {
    const s = setup();
    s.target.handle('down', [point(1, 100, 200)]);
    s.target.handle('move', [point(1, 120, 220)]);
    if (end === 'suspend') { s.target.suspend(); s.target.resume(); }
    else s.target.handle(end, [point(1, 120, 220)]);
    const state = s.state();
    s.target.handle('move', [point(1, 400, 700)]);
    assert.deepEqual(s.state(), state);
    assert.equal(s.target.snapshot().primary, null);
    assert.equal(s.target.snapshot().captured, null);
    drag(s);
    assert.notDeepEqual(s.state(), state);
  }
});

test('second finger never reaches pinch, and lifting primary does not adopt the held finger', () => {
  const s = setup();
  s.target.handle('down', [point(1, 100, 200)]);
  s.target.handle('down', [point(2, 200, 300)]);
  const initial = s.state();
  s.target.handle('move', [point(2, 350, 700)]);
  assert.deepEqual(s.state(), initial);
  s.target.handle('move', [point(1, 120, 220)]);
  assert.notDeepEqual(s.state(), initial);
  assert.equal(s.camera.radius, 6);
  s.target.handle('up', [point(1, 120, 220)]);
  const released = s.state();
  s.target.handle('move', [point(2, 120, 200)]);
  assert.deepEqual(s.state(), released);
  s.target.handle('down', [point(3, 100, 200)]);
  s.target.handle('move', [point(3, 140, 250)]);
  assert.notDeepEqual(s.state(), released);
  assert.deepEqual(s.state().slice(2), [6, 0, 0, 0]);
});

test('batch downs select one primary and duplicate downs cannot reset its last position', () => {
  const s = setup();
  s.target.handle('down', [point(1, 100, 200), point(2, 200, 300)]);
  s.target.handle('down', [point(1, 400, 700)]);
  s.target.handle('move', [point(1, 110, 210)]);
  const reference = setup(); drag(reference, point(1, 110, 210));
  assert.deepEqual(s.state(), reference.state());
  assert.equal(s.target.snapshot().trackedTouches, 2);
});

test('captured drag continues outside the view, clamps both poles, and never pans or zooms', () => {
  const s = setup();
  s.target.handle('down', [point(1, 100, 200)]);
  s.target.handle('move', [point(1, -5000, -5000)]);
  assert.equal(s.camera.phi, Math.PI - .1);
  s.target.handle('move', [point(1, 5000, 5000)]);
  assert.equal(s.camera.phi, .1);
  assert.deepEqual(s.state().slice(2), [6, 0, 0, 0]);
});

test('dispose ends active gesture and removes listeners; rebuilding does not double rotation', () => {
  const s = setup();
  s.target.handle('down', [point(1, 100, 200)]);
  s.target.suspend(); s.orbit.dispose(); s.target.dispose(); s.target.dispose();
  const state = s.state();
  drag(s);
  assert.deepEqual(s.state(), state);
  assert.deepEqual(s.target.snapshot(), { primary: null, captured: null, trackedTouches: 0, listenerCount: 0, paused: true, disposed: true });
  const next = setup(), reference = setup(); drag(next); drag(reference);
  assert.deepEqual(next.state(), reference.state());
  assert.equal(next.target.snapshot().listenerCount, 6);
});

test('native identity compares underlying touch across new wrappers and never reuses IDs', () => {
  const ids = new TouchIdentity((a, b) => a.native === b.native);
  const a = ids.begin({ native: 'a' }), b = ids.begin({ native: 'b' });
  assert.equal(ids.find({ native: 'a' }), a);
  assert.notEqual(a, b);
  ids.end(a);
  assert.equal(ids.find({ native: 'a' }), undefined);
  ids.clear();
  assert.equal(ids.count, 0);
  assert.ok(ids.begin({ native: 'a' }) > b);
});
