import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeDemandFrames } from '../../../bridge/lifecycle/demand-frames.ts';

// Reproduce Engine FrameLoop's schedule-at-end semantics, including the
// stop/restart race when a later after-update listener requests another frame.
function harness() {
  const tasks = [], raf = new Map();
  let running = false, id = 0, latest = 0, frames = 0, animating = false;
  const driver = {
    start() { if (!running) { running = true; schedule(); } },
    stop() { running = false; raf.delete(latest); },
    defer(fn) { tasks.push(fn); },
  };
  const gate = new NativeDemandFrames(driver);
  const schedule = () => { latest = ++id; raf.set(latest, () => {}); };
  const flush = () => { while (tasks.length) tasks.shift()(); };
  const tick = (after = () => {}) => {
    const key = raf.keys().next().value;
    if (key === undefined) return false;
    raf.delete(key);
    frames++;
    gate.afterFrame(animating);
    after();
    if (running) schedule();
    flush();
    assert.ok(raf.size <= 1, 'exactly one RAF chain');
    return true;
  };
  return { gate, flush, tick, raf, tasks, get frames() { return frames; }, animate(value) { animating = value; } };
}
test('cold start settles in two frames and idle performs no further callbacks', () => {
  const h = harness(); h.gate.resume(); h.flush();
  assert.ok(h.tick()); assert.ok(h.tick());
  for (let i = 0; i < 3600; i++) assert.equal(h.tick(), false);
  assert.equal(h.frames, 2); assert.equal(h.tasks.length, 0); assert.equal(h.raf.size, 0);
});
test('a burst of touch events coalesces, while late GUI invalidation cannot create duplicate loops', () => {
  const h = harness(); h.gate.resume(); h.flush(); h.tick(); h.tick();
  for (let i = 0; i < 100; i++) h.gate.request();
  assert.equal(h.tasks.length, 1); h.flush(); h.tick();
  // GUI/test listener runs after the host decided to stop this tick.
  h.tick(() => { h.gate.request(); h.gate.request(); });
  assert.equal(h.raf.size, 1);
  h.tick(); h.tick(); assert.equal(h.raf.size, 0);
});
test('animations render to completion; async worker result wakes a sleeping engine', () => {
  const h = harness(); h.gate.resume(); h.flush(); h.animate(true);
  for (let i = 0; i < 240; i++) assert.ok(h.tick());
  h.animate(false); h.tick(); h.tick(); assert.equal(h.raf.size, 0);
  h.gate.request(); h.flush(); h.tick(); h.tick(); assert.equal(h.frames, 244);
  assert.equal(h.raf.size, 0);
});
test('suspend blocks queued and async wakeups; resume redraws; disposal is terminal', () => {
  const h = harness(); h.gate.resume(); h.gate.suspend(); h.flush();
  h.gate.request(); h.flush(); assert.equal(h.raf.size, 0);
  h.gate.resume(); h.flush(); h.tick(); h.tick(); assert.equal(h.frames, 2);
  h.gate.request(); h.gate.dispose(); h.flush();
  h.gate.resume(); h.gate.request(); h.flush(); assert.equal(h.raf.size, 0);
});
