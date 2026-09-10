import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeViewRect } from '../../../bridge/render/view-rect.ios.ts';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../../../bridge/input/pointer-target.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { OrbitPointerTarget } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('landscape picking uses UIKit drawing bounds rather than safe-area measurement', () => {
  const view = { clientWidth: 814, clientHeight: 361,
    nativeViewProtected: { bounds: { origin: { x: 0, y: 0 }, size: { width: 932, height: 361 } } },
    getLocationInWindow: () => ({ x: 0, y: 48 }) };
  const rect = nativeViewRect(view);
  assert.equal(rect.width, 932);
  const target = new OrbitPointerTarget(() => nativeViewRect(view));
  let ndc;
  target.addEventListener('pointerdown', event => {
    ndc = [(event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2];
  });
  target.handle('down', [{ id: 1, x: 466, y: 180.5 }]);
  assert.deepEqual(ndc, [0, 0]);
  view.nativeViewProtected.bounds.size.width = 430;
  view.getLocationInWindow = () => ({ x: 20, y: 59 });
  assert.equal(nativeViewRect(view).right, 450);
});
