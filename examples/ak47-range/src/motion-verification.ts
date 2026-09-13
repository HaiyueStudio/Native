import { File, knownFolders, path } from '@nativescript/core';
import type { HaiyueEngine } from '@haiyue/engine';
import { NativeDeviceMotion, type NativeMotionSample } from '../../../bridge/motion/device-motion.ios';

/** Explicit MOTION_VERIFY=1 diagnostic; never changes game controls. */
export function verifyNativeMotion(engine: HaiyueEngine): () => void {
  const output = File.fromPath(path.join(knownFolders.documents().path, 'native-motion-verification.json'));
  const motion = new NativeDeviceMotion({ updateIntervalMs: 20, screenRotation: 90 });
  const samples: NativeMotionSample[] = [], checks: string[] = [];
  let elapsed = 0, finished = false;
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); checks.push(message); };
  const dispose = () => { engine.off('update', update); motion.dispose(); };
  const finish = (error?: unknown) => {
    if (finished) return;
    finished = true; dispose();
    output.writeTextSync(JSON.stringify({ status: error ? 'failed' : 'passed', error: error ? String(error) : undefined,
      generatedAt: new Date().toISOString(), checks, sampleCount: samples.length,
      first: samples[0], last: samples[samples.length - 1] }, null, 2));
  };
  const update = ({ detail }: { detail: { delta: number } }) => {
    try {
      elapsed += detail.delta;
      if (elapsed > 15000) throw new Error('Timed out waiting for fresh device-motion samples');
      motion.update(detail.delta);
    } catch (error) { finish(error); }
  };
  motion.onUpdate(sample => {
    samples.push(sample);
    if (samples.length === 1) {
      check(motion.active, 'Core Motion reports an active physical device-motion service');
      check(sample.sensorDeltaMs === 0, 'first sensor delta starts at zero');
    }
    if (samples.length === 60) {
      motion.suspend(); check(!motion.active && motion.latest === null, 'suspend stops hardware and clears stale data');
      motion.resume(); check(motion.update(0) === null, 'resume does not replay cached sensor data');
    }
    if (samples.length === 61) check(sample.sensorDeltaMs === 0, 'resume starts a new sensor timing interval');
    if (samples.length === 120) {
      check(samples.every(s => Math.abs(Math.hypot(s.gravity.x, s.gravity.y, s.gravity.z) - 1) < 0.1), 'physical gravity samples have unit-g magnitude');
      check(samples.every(s => Math.abs(Math.hypot(s.quaternion.x, s.quaternion.y, s.quaternion.z, s.quaternion.w) - 1) < 0.01), 'physical attitude quaternions are normalized');
      check(samples.every((s, i) => i === 0 || s.timestampMs > samples[i - 1]!.timestampMs), 'sensor timestamps increase without duplicate emissions');
      check(samples.every(s => Math.abs(s.angles.pitch - s.radians.pitch * 180 / Math.PI) < 1e-8 && s.screenRotation === 90), 'degree conversion and screen-axis configuration reach native consumers');
      motion.stop(); motion.resume(); check(!motion.active && motion.update(16) === null, 'explicit stop remains stopped on resume');
      finish();
    }
  });
  engine.on('update', update);
  try { check(motion.start(), 'physical gyroscope and fused device-motion data are available'); }
  catch (error) { finish(error); }
  return dispose;
}
