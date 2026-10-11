import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './support/load-ts.mjs';

const { SurfaceLease } = loadTS('desktop/host/surface.ts');
test('transient native surface failure preserves frame ownership and recovers on next acquisition', () => {
  let attempts = 0, configurations = 0, presents = 0;
  const texture = {};
  const lease = new SurfaceLease({ configure() { configurations++; }, unconfigure() {}, getCurrentTexture() {
    if (++attempts === 1) throw new Error('Invalid Surface Status'); return texture;
  } }, () => { presents++; });
  lease.configure({}); assert.equal(lease.acquire(), false); assert.throws(() => lease.current(), /acquired/);
  assert.equal(lease.acquire(), true); assert.equal(lease.acquire(), true);
  assert.equal(lease.current(), texture); assert.equal(attempts, 2); assert.equal(configurations, 2);
  assert.equal(lease.present(), true); assert.equal(lease.present(), false); assert.equal(presents, 1);
  lease.unconfigure(); assert.equal(lease.acquire(), false);
});
test('persistent foreground surface loss is bounded and unrelated GPU failures are fatal', () => {
  const context = { configure() {}, getCurrentTexture() { throw new Error('Invalid Surface Status'); } };
  const lease = new SurfaceLease(context, () => {}); lease.configure({});
  for (let i = 0; i < 200; i++) assert.equal(lease.acquire(false), false);
  for (let i = 0; i < 119; i++) assert.equal(lease.acquire(true), false);
  assert.throws(() => lease.acquire(true), /120 foreground/);
  context.getCurrentTexture = () => { throw new Error('Out of memory'); };
  assert.throws(() => lease.acquire(false), /Out of memory/);
});
test('WebGPU typed offset adapter preserves overloads and restores all prototypes', () => {
  class Encoder { setBindGroup(...args) { return args; } }
  class Render extends Encoder {} class Compute extends Encoder {} class Bundle extends Encoder {}
  const original = Render.prototype.setBindGroup;
  const { installWebGpuCompatibility } = loadTS('desktop/host/webgpu-compat.ts', {}, {
    GPURenderPassEncoder: Render, GPUComputePassEncoder: Compute, GPURenderBundleEncoder: Bundle, Uint32Array,
  });
  const restore = installWebGpuCompatibility(), offsets = new Uint32Array([256, 512]);
  for (const Ctor of [Render, Compute, Bundle]) {
    const e = new Ctor(); assert.deepEqual(e.setBindGroup(0, null, offsets), [0, null, offsets, 0, 2]);
    assert.deepEqual(e.setBindGroup(0, null, offsets, 1, 1), [0, null, offsets, 1, 1]);
    assert.deepEqual(e.setBindGroup(0, null), [0, null]);
    assert.deepEqual(e.setBindGroup(0, null, [3]), [0, null, [3]]);
  }
  restore(); assert.equal(Render.prototype.setBindGroup, original);
});

function fixture(surfaceFailure = false) {
  const callbacks = {}, calls = [];
  const symbols = new Proxy({}, { get: (_, name) => {
    if (name.startsWith('glfwSet') && name.endsWith('Callback')) return (_window, callback) => { callbacks[name] = callback; };
    if (name === 'glfwGetWindowSize' || name === 'glfwGetFramebufferSize') return (_window, w, h) => { w[0] = 100; h[0] = 80; };
    if (name === 'glfwCreateWindow' || name === 'glfwGetCocoaWindow' || name === 'glfwGetCocoaView') return () => ({});
    if (name === 'glfwInit') return () => 1;
    return () => { calls.push(name); return 0; };
  } });
  const Deno = { build: { os: 'darwin' }, dlopen: () => ({ symbols, close() { calls.push('library-close'); } }),
    UnsafeCallback: class { constructor(_definition, fn) { this.pointer = fn; } close() { calls.push('callback-close'); } },
    UnsafeWindowSurface: class {
      constructor() { if (surfaceFailure) throw new Error('Surface setup failed'); }
      getContext() { return { unconfigure() { calls.push('unconfigure'); } }; }
    },
  };
  const { GlfwWindow } = loadTS('desktop/host/glfw.ts', {}, { Deno, TextEncoder });
  return { callbacks, calls, create: () => new GlfwWindow('test', { title: 'test', width: 100, height: 80 }) };
}
test('focus loss cancels pressed pointers and keys; disposal releases callbacks once', () => {
  const f = fixture(), window = f.create(), events = [];
  for (const type of ['pointerdown', 'pointercancel', 'keydown', 'keyup', 'blur']) window.on(type, e => events.push(e));
  f.callbacks.glfwSetMouseButtonCallback(null, 0, 1, 0);
  f.callbacks.glfwSetKeyCallback(null, 65, 0, 1, 0);
  f.callbacks.glfwSetWindowFocusCallback(null, 0);
  assert.deepEqual(events.map(e => e.type), ['pointerdown', 'keydown', 'pointercancel', 'keyup', 'blur']);
  assert.equal(events[2].buttons, 0); assert.equal(events[3].key, 'a');
  window.dispose(); window.dispose(); assert.equal(f.calls.filter(c => c === 'glfwDestroyWindow').length, 1);
  assert.equal(f.calls.filter(c => c === 'callback-close').length, 8); assert.equal(window.closed, true);
});
test('FFI callback exceptions propagate on poll instead of unwinding through native code', () => {
  const f = fixture(), window = f.create(); window.on('keydown', () => { throw new Error('Game input failed'); });
  assert.doesNotThrow(() => f.callbacks.glfwSetKeyCallback(null, 65, 0, 1, 0));
  assert.throws(() => window.poll(), /Game input failed/); window.dispose();
});
test('partial surface construction releases native window and library', () => {
  const f = fixture(true); assert.throws(f.create, /Surface setup failed/);
  assert.equal(f.calls.filter(c => c === 'glfwDestroyWindow').length, 1); assert.equal(f.calls.at(-1), 'library-close');
});
