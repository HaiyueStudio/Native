import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { OrbitControl, SphericalTransform3D } from '@haiyue/engine';
function load(file, imports = {}) {
  const source = readFileSync(new URL(`../../../bridge/${file}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, exports);
  return exports;
}
test('native pinch cancels primary input and prevents remaining-finger takeover across lifecycle', () => {
  let observer;
  class GesturesObserver {
    constructor(view, callback) { this.callback = callback; observer = this; }
    observe() {} disconnect() { this.disconnected = true; }
  }
  const rect = { x: 59, y: 0, left: 59, top: 0, width: 814, height: 409 };
  const { NativeTouchInput } = load('input/native-touch.ios', {
    '../render/view-rect.ios': { nativeViewRect: () => rect },
    '@nativescript/core/ui/gestures': { GesturesObserver, GestureTypes: { touch: 1 } },
    './pointer-target': load('input/pointer-target'), './touch-identity': load('input/touch-identity'),
  });
  const view = { ignoreTouchEvents: true, nativeViewProtected: { multipleTouchEnabled: false, bounds: { origin: { x: 0, y: 0 } } }, on() {}, off() {} };
  const input = new NativeTouchInput(view, () => {}, { pinchZoom: true });
  const camera = new SphericalTransform3D({ radius: 720, theta: 0, phi: 0.5 });
  const orbit = new OrbitControl(input.orbitTarget, camera, { minRadius: 540, maxRadius: 1080 });
  const primary = [];
  for (const type of ['pointerdown', 'pointercancel']) input.target.addEventListener(type, e => primary.push([type, e.pointerId]));
  const fingers = [1, 2, 3].map(hash => ({ hash, timestamp: hash, isEqual(other) { return this.hash === other.hash; } }));
  const emit = (action, points) => observer.callback({ action, getActivePointers: () => points.map(([id, x, y]) => ({ ios: fingers[id - 1], getX: () => x, getY: () => y })) });
  emit('down', [[1, 300, 200]]);
  emit('down', [[2, 500, 200]]);
  assert.equal(input.isPinching, true);
  assert.deepEqual(primary.map(e => e[0]), ['pointerdown', 'pointercancel']);
  emit('move', [[1, 290, 200]]); emit('move', [[2, 520, 200]]);
  assert.ok(camera.radius < 720);
  emit('up', [[1, 290, 200]]);
  const stopped = [camera.radius, camera.theta, camera.phi];
  emit('move', [[2, 700, 250]]);
  assert.deepEqual([camera.radius, camera.theta, camera.phi], stopped);
  emit('up', [[2, 700, 250]]);
  assert.equal(input.isPinching, false);
  emit('down', [[1, 300, 200]]); emit('move', [[1, 310, 210]]);
  assert.notEqual(camera.theta, stopped[1]);
  emit('down', [[2, 500, 200]]); emit('down', [[3, 600, 200]]);
  const third = [camera.radius, camera.theta, camera.phi];
  emit('move', [[2, 650, 200]]);
  assert.deepEqual([camera.radius, camera.theta, camera.phi], third);
  input.suspend(); input.resume();
  emit('move', [[1, 350, 200]]);
  assert.deepEqual([camera.radius, camera.theta, camera.phi], third);
  assert.equal(input.snapshot().nativeIdentities, 0);
  orbit.dispose(); input.dispose();
  assert.equal(observer.disconnected, true);
  assert.equal(view.nativeViewProtected.multipleTouchEnabled, false);
});
