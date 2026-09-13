import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const encode = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
}).outputText;
const mathUrl = encode(compile('../../../bridge/motion/motion-sample.ts'));
const { createMotionSample } = await import(mathUrl);
const handlers = new Map();
const app = { inBackground: false, suspended: false, suspendEvent: 'suspend', resumeEvent: 'resume', exitEvent: 'exit',
  on(event, callback) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(callback); },
  off(event, callback) { handlers.get(event)?.delete(callback); } };
const emit = event => { for (const fn of [...(handlers.get(event) ?? [])]) fn(); };
const sensor = { gyroAvailable: true, deviceMotionAvailable: true, deviceMotionActive: false, deviceMotion: null,
  starts: 0, stops: 0, fail: false,
  startDeviceMotionUpdatesUsingReferenceFrame(frame) { assert.equal(frame, 1); this.starts++; this.deviceMotionActive = true; if (this.fail) throw Error('native start failed'); },
  stopDeviceMotionUpdates() { this.stops++; this.deviceMotionActive = false; } };
globalThis.__motionTestApplication = app;
globalThis.CMAttitudeReferenceFrame = { XArbitraryZVertical: 1 };
globalThis.CMMotionManager = { alloc: () => ({ init: () => sensor }), availableAttitudeReferenceFrames: () => 1 };
const nativeSource = compile('../../../bridge/motion/device-motion.ios.ts')
  .replace("from '@nativescript/core'", `from '${encode('export const Application = globalThis.__motionTestApplication;')}'`)
  .replaceAll("from './motion-sample'", `from '${mathUrl}'`);
const { NativeDeviceMotion } = await import(encode(nativeSource));
const reading = (timestamp = 1, gravity = { x: 0, y: 0, z: -1 }) => ({ timestamp,
  attitude: { pitch: Math.PI / 6, roll: -Math.PI / 4, yaw: Math.PI / 2, quaternion: { x: 0, y: 0, z: 0, w: 1 } },
  gravity, rotationRate: { x: 1, y: 2, z: 3 }, userAcceleration: { x: 0, y: 0, z: 0 } });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('angles use degrees while radians, quaternion, rate and acceleration retain their units', () => {
  const raw = reading(), sample = createMotionSample(raw, 16, 10, 0);
  near(sample.angles.pitch, 30); near(sample.angles.roll, -45); near(sample.angles.yaw, 90);
  assert.equal(sample.timestampMs, 1000); assert.equal(sample.deltaMs, 16); assert.equal(sample.sensorDeltaMs, 10);
  assert.equal(sample.radians.pitch, raw.attitude.pitch); assert.deepEqual(sample.rotationRate, raw.rotationRate);
  raw.gravity.z = 0; assert.equal(sample.gravity.z, -1);
  assert.ok(Object.isFrozen(sample) && Object.isFrozen(sample.angles));
});
test('gravity tilt covers left/right, forward/back, face down and all screen rotations', () => {
  for (const sign of [-1, 1]) {
    const raw = reading(1, { x: sign * 0.5, y: 0, z: -Math.sqrt(0.75) });
    near(createMotionSample(raw, 0, 0, 0).tilt.right, sign * 30);
    near(createMotionSample(raw, 0, 0, 90).tilt.forward, sign * 30);
    near(createMotionSample(raw, 0, 0, 180).tilt.right, -sign * 30);
    near(createMotionSample(raw, 0, 0, 270).tilt.forward, -sign * 30);
    near(createMotionSample(reading(1, { x: 0, y: sign * 0.5, z: -Math.sqrt(0.75) }), 0, 0, 0).tilt.forward, sign * 30);
  }
  near(createMotionSample(reading(), 0, 0, 0).tilt.total, 0);
  near(createMotionSample(reading(1, { x: 0, y: 0, z: 1 }), 0, 0, 0).tilt.total, 180);
  assert.throws(() => createMotionSample(reading(1, { x: 0, y: 0, z: 0 }), 0, 0, 0));
});
test('frame polling emits fresh samples only; stop, background, resume and disposal cleanly own the sensor', () => {
  sensor.deviceMotion = null;
  const motion = new NativeDeviceMotion({ updateIntervalMs: 20 }); const received = [];
  const off = motion.onUpdate(s => received.push(s));
  try {
    assert.throws(() => new NativeDeviceMotion());
    assert.equal(motion.start(), true); const starts = sensor.starts;
    motion.start(); assert.equal(sensor.starts, starts); assert.equal(sensor.deviceMotionUpdateInterval, 0.02);
    assert.equal(motion.update(16), null);
    sensor.deviceMotion = reading(1); assert.equal(motion.update(16).sensorDeltaMs, 0);
    assert.equal(motion.update(16), null);
    sensor.deviceMotion = reading(1.02); near(motion.update(16).sensorDeltaMs, 20);
    emit('suspend'); assert.equal(motion.active, false); assert.equal(motion.latest, null);
    sensor.deviceMotion = reading(2); assert.equal(motion.update(16), null);
    emit('resume'); assert.equal(motion.update(16), null); // Cached pre-resume sample is stale.
    sensor.deviceMotion = reading(2.02); assert.equal(motion.update(16).sensorDeltaMs, 0);
    motion.setUpdateInterval(50); assert.equal(sensor.deviceMotionUpdateInterval, 0.05);
    motion.stop(); emit('resume'); assert.equal(motion.active, false);
    off(); motion.start(); sensor.deviceMotion = reading(3); motion.update(16); assert.equal(received.length, 3);
  } finally { motion.dispose(); }
  assert.equal([...handlers.values()].reduce((n, h) => n + h.size, 0), 0);
  assert.equal(motion.update(16), null); assert.throws(() => motion.start());
  motion.dispose();
});
test('unavailable hardware, invalid parameters and failed starts cannot leave collection active', () => {
  assert.throws(() => new NativeDeviceMotion({ updateIntervalMs: NaN }));
  assert.throws(() => new NativeDeviceMotion({ screenRotation: 45 }));
  const motion = new NativeDeviceMotion();
  try {
    sensor.gyroAvailable = false; assert.equal(motion.start(), false); sensor.gyroAvailable = true;
    sensor.fail = true; assert.throws(() => motion.start(), /native start failed/); assert.equal(motion.active, false);
    sensor.fail = false; emit('resume'); assert.equal(motion.active, false);
    for (const dt of [-1, NaN, Infinity]) assert.throws(() => motion.update(dt));
    emit('exit'); assert.throws(() => motion.onUpdate(() => {}));
  } finally { sensor.gyroAvailable = true; sensor.fail = false; motion.dispose(); }
});
