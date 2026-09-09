import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../../../bridge/lifecycle/host.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function setup({ delayed = false } = {}) {
  const application = new EventEmitter();
  Object.assign(application, { suspendEvent: 'suspend', resumeEvent: 'resume' });
  const view = new EventEmitter();
  const sequence = [], events = [];
  let engine, releaseInit;
  const frames = { pendingCount: 0, cancelAll() { sequence.push('cancel-frames'); this.pendingCount = 0; } };
  const device = new EventEmitter();
  device.addEventListener = device.on.bind(device);
  device.removeEventListener = device.off.bind(device);
  class Engine extends EventEmitter {
    constructor(options) { super(); engine = this; Object.assign(this, { state: 'created', options, device, clearColor: options.clearColor, width: 860, height: 1678, format: 'bgra8unorm', renderProfile: 'simple' }); }
    async init() { if (delayed) await new Promise(resolve => { releaseInit = resolve; }); this.state = 'ready'; }
    createScene() { return {}; }
    switchScene() {}
    run() { sequence.push('run'); frames.pendingCount = 1; }
    stop() { sequence.push('stop'); frames.pendingCount = 0; }
    resizeToDisplaySize() { sequence.push('resize'); }
    waitForRecovery() { return Promise.resolve(); }
    destroy() { sequence.push('destroy-engine'); this.state = 'destroyed'; }
  }
  class Surface {
    hasLayout = true; pixelRatio = 2; presentedFrames = 0;
    engineOptions() { return {}; }
    present() { this.presentedFrames++; return true; }
    release() { sequence.push('release-surface'); }
  }
  const input = {
    disposed: false, primary: 1,
    suspend() { sequence.push('cancel-input'); this.primary = null; },
    resume() { sequence.push('resume-input'); },
    dispose() { sequence.push('dispose-input'); this.disposed = true; this.primary = null; },
    snapshot() { return { disposed: this.disposed, primary: this.primary }; },
  };
  const dependencies = {
    '@nativescript/core': { Application: application, File: { fromPath: () => ({ writeTextSync() {} }) }, knownFolders: { documents: () => ({ path: '/test' }) }, path: { join: (...parts) => parts.join('/') } },
    '@haiyue/engine': { HaiyueEngine: Engine },
    '../render/surface': { NativeSurface: Surface },
    '../render/frame-capture.ios': { isFrameCaptureRequested: () => false },
    './runtime': { nativeFrames: frames, installNativeFrameRuntime() {} },
  };
  const exports = {};
  Function('require', 'exports', 'console', compiled)(id => dependencies[id], exports, { log(line) { events.push(JSON.parse(line.slice(line.indexOf('{')))); }, error() {} });
  const host = new exports.NativeRenderHost(view, () => {}, { bindInput: () => input });
  return { host, application, view, input, frames, sequence, events, engine: () => engine, releaseInit: () => releaseInit() };
}

test('five resume cycles clear input before stopping, refresh layout, and keep one callback', async () => {
  const s = setup(); await settle();
  for (let i = 0; i < 5; i++) {
    s.input.primary = i + 1;
    s.sequence.length = 0;
    s.application.emit('suspend');
    assert.deepEqual(s.sequence.slice(0, 3), ['cancel-input', 'stop', 'cancel-frames']);
    assert.equal(s.input.primary, null);
    assert.equal(s.frames.pendingCount, 0);
    s.application.emit('resume');
    assert.equal(s.frames.pendingCount, 1);
    const calls = s.sequence.length;
    s.application.emit('resume');
    assert.equal(s.sequence.length, calls);
  }
  assert.equal(s.events.filter(e => e.event === 'resume').length, 5);
  assert.equal(s.application.listenerCount('suspend'), 1);
  assert.equal(s.application.listenerCount('resume'), 1);
});

test('background during asynchronous init prevents run until foreground', async () => {
  const s = setup({ delayed: true });
  s.application.emit('suspend'); s.releaseInit(); await settle();
  assert.equal(s.sequence.includes('run'), false);
  assert.equal(s.input.primary, null);
  s.application.emit('resume');
  assert.equal(s.frames.pendingCount, 1);
});

test('dispose during init cannot bind input or start a late frame loop', async () => {
  const s = setup({ delayed: true });
  s.host.dispose(); s.releaseInit(); await settle();
  assert.equal(s.sequence.includes('run'), false);
  assert.equal(s.events.some(e => e.event === 'input-ready'), false);
  assert.equal(s.application.listenerCount('resume'), 0);
  assert.equal(s.view.listenerCount('layoutChanged'), 0);
});

test('dispose removes listeners and input before GPU teardown; stale lifecycle events do nothing', async () => {
  const s = setup(); await settle(); s.sequence.length = 0;
  s.host.dispose();
  assert.ok(s.sequence.indexOf('dispose-input') < s.sequence.indexOf('destroy-engine'));
  assert.equal(s.input.disposed, true);
  assert.equal(s.frames.pendingCount, 0);
  const calls = s.sequence.length;
  s.host.dispose(); s.application.emit('resume'); s.application.emit('suspend'); s.view.emit('layoutChanged');
  assert.equal(s.sequence.length, calls);
  assert.equal(s.engine().device.listenerCount('uncapturederror'), 0);
});

test('GPU failure cancels input and refuses the remainder of the failed frame', async () => {
  const s = setup(); await settle();
  s.engine().device.emit('uncapturederror', { error: new Error('test validation failure') });
  s.engine().emit('after-update'); await settle();
  assert.equal(s.events.some(e => e.event === 'present'), false);
  assert.equal(s.input.disposed, true);
  assert.equal(s.frames.pendingCount, 0);
  assert.equal(s.engine().state, 'destroyed');
});
