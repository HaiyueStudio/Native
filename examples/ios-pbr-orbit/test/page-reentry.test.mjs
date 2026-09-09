import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/main-page.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function setup() {
  const application = new EventEmitter();
  Object.assign(application, { uncaughtErrorEvent: 'error', exitEvent: 'exit', inBackground: false, suspended: false });
  const hosts = [];
  class Host {
    disposed = false;
    constructor(canvas) { this.canvas = canvas; hosts.push(this); }
    dispose() { this.disposed = true; }
  }
  const dependencies = {
    '@nativescript/core': { Application: application },
    '../../../bridge/lifecycle/host': { NativeRenderHost: Host },
    './pbr-scene': { preparePbrScene() {} },
    './orbit-session': { bindOrbit() {} },
  };
  const exports = {};
  Function('require', 'exports', 'NSProcessInfo', compiled)(id => dependencies[id], exports, { processInfo: { environment: { objectForKey: () => null } } });
  const label = {};
  const canvas = {};
  const page = { getViewById: id => id === 'surface' ? canvas : label };
  canvas.page = page;
  return { application, hosts, canvas, page, api: exports };
}

test('Page loaded before Canvas ready waits, and duplicate ready/loaded do not add hosts', () => {
  const s = setup();
  s.api.onLoaded({ object: s.page });
  assert.equal(s.hosts.length, 0);
  s.api.onCanvasReady({ object: s.canvas });
  s.api.onLoaded({ object: s.page });
  s.api.onCanvasReady({ object: s.canvas });
  assert.equal(s.hosts.length, 1);
  assert.equal(s.application.listenerCount('exit'), 1);
});

test('returning to the same ready Canvas recreates exactly one host after permanent unload', () => {
  const s = setup();
  s.api.onCanvasReady({ object: s.canvas });
  s.api.onUnloaded();
  assert.equal(s.hosts[0].disposed, true);
  assert.equal(s.application.listenerCount('exit'), 0);
  s.api.onLoaded({ object: s.page });
  s.api.onLoaded({ object: s.page });
  assert.equal(s.hosts.length, 2);
  assert.equal(s.application.listenerCount('exit'), 1);
});

test('background Page unload retains the paused host, while exit disposes it', () => {
  const s = setup();
  s.api.onCanvasReady({ object: s.canvas });
  s.application.inBackground = true;
  s.api.onUnloaded();
  assert.equal(s.hosts[0].disposed, false);
  s.application.inBackground = false;
  s.api.onLoaded({ object: s.page });
  assert.equal(s.hosts.length, 1);
  s.application.emit('exit');
  assert.equal(s.hosts[0].disposed, true);
  assert.equal(s.application.listenerCount('exit'), 0);
});
