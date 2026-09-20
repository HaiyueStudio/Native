import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('late unload/exit from the previous Android page cannot dispose the new host', () => {
  const listeners = new Map(), hosts = [];
  const Application = {
    exitEvent: 'exit', uncaughtErrorEvent: 'error', inBackground: false, suspended: false,
    on(name, callback) { listeners.set(name, callback); },
    off(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
  };
  class Host {
    disposed = false;
    constructor() { hosts.push(this); }
    dispose() { this.disposed = true; }
  }
  class Input {
    target = { addEventListener() {}, removeEventListener() {}, releasePointerCapture() {} };
  }
  const modules = {
    '@nativescript/core': { Application, Connectivity: { startMonitoring() {}, stopMonitoring() {} } },
    './rewards-config': {CALENDAR_REWARDS:{dailyFree:1,dailyAds:2}},
    '../../../bridge/rewards/controller': {RewardController:class {}},
    '../../../bridge/rewards/admob': {AdMobRewardGateway:class {}},
    './development': { isDevelopmentBuild: () => true },
    './purchases/store': { CalendarStore: class {} },
    '../../../bridge/purchases/controller': { PurchaseController: class { refresh() {} dispose() {} } },
    '../../../bridge/lifecycle/launch-flags': { nativeLaunchFlag: () => false },
    '../../../bridge/lifecycle/host': { NativeRenderHost: Host },
    '../../../bridge/input/native-touch': { NativeTouchInput: Input },
    '../../../bridge/branding/engine-splash': { NativeEngineSplash: class { dispose() {} } },
    '../../../bridge/storage/settings-storage': { NativeSettingsStorage: class {} },
    '@haiyue/engine/save': { LocalStorageSaveBackend: class {} },
  };
  const exports = {};
  const source = readFileSync(new URL('../src/main-page.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(js, { exports, require: name => modules[name] ?? {}, console });
  const page = () => { const p = { getViewById: () => ({}) }; return { object: { page: p, _context: {} }, page: p }; };
  const first = page(), next = page();
  exports.onCanvasReady(first);
  exports.onCanvasReady(next);
  assert.equal(hosts[0].disposed, true);
  assert.equal(hosts[1].disposed, false);
  exports.onUnloaded({ object: first.page });
  listeners.get('exit')({ android: first.object._context });
  assert.equal(hosts[1].disposed, false);
  // Background unload keeps the owning page available for resume.
  Application.inBackground = true;
  exports.onUnloaded({ object: next.page });
  assert.equal(hosts[1].disposed, false);
  Application.inBackground = false;
  listeners.get('exit')({ android: next.object._context });
  assert.equal(hosts[1].disposed, true);
  assert.equal(listeners.has('exit'), false);
});
