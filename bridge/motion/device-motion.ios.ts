import { Application } from '@nativescript/core';
import { createMotionSample, validateMotionInterval, validateScreenRotation,
  type NativeMotionSample, type MotionScreenRotation, type MotionReading } from './motion-sample';
export type { NativeMotionSample, MotionScreenRotation } from './motion-sample';
// NativeScript's default iOS typings omit CoreMotion. Keep this binding limited to the public SDK methods used here.
interface CoreMotionManager {
  readonly gyroAvailable: boolean;
  readonly deviceMotionAvailable: boolean;
  readonly deviceMotionActive: boolean;
  readonly deviceMotion: MotionReading | null;
  deviceMotionUpdateInterval: number;
  startDeviceMotionUpdatesUsingReferenceFrame(frame: number): void;
  stopDeviceMotionUpdates(): void;
}
declare const CMMotionManager: {
  alloc(): { init(): CoreMotionManager };
  availableAttitudeReferenceFrames(): number;
};
const X_ARBITRARY_Z_VERTICAL = 1; // CMAttitudeReferenceFrameXArbitraryZVertical in CoreMotion.framework.
export interface NativeDeviceMotionOptions {
  /** Requested sensor interval, 5–1000 ms. Actual hardware rate may differ. */
  updateIntervalMs?: number;
  screenRotation?: MotionScreenRotation;
}
let manager: CoreMotionManager | null = null;
let owner: NativeDeviceMotion | null = null;
/** One app-owned controller; poll from the existing Engine frame, never add another frame loop. */
export class NativeDeviceMotion {
  private readonly motion: CoreMotionManager;
  private readonly listeners = new Set<(sample: NativeMotionSample) => void>();
  private interval: number;
  private rotation: MotionScreenRotation;
  private requested = false;
  private running = false;
  private suspended = false;
  private disposed = false;
  private lastTimestamp: number | null = null;
  private timestampFloor = -Infinity;
  private sample: NativeMotionSample | null = null;
  constructor(options: NativeDeviceMotionOptions = {}) {
    this.interval = validateMotionInterval(options.updateIntervalMs ?? 1000 / 60);
    this.rotation = validateScreenRotation(options.screenRotation ?? 0);
    if (owner) throw new Error('Only one NativeDeviceMotion controller may exist per app.');
    if (typeof CMMotionManager === 'undefined') throw new Error('Core Motion is unavailable on this platform.');
    manager ??= CMMotionManager.alloc().init();
    this.motion = manager; owner = this;
    this.suspended = !!(Application.inBackground || Application.suspended);
    Application.on(Application.suspendEvent, this.suspend);
    Application.on(Application.resumeEvent, this.resume);
    Application.on(Application.exitEvent, this.dispose);
  }
  get available(): boolean { return this.motion.gyroAvailable && this.motion.deviceMotionAvailable; }
  get active(): boolean { return this.running && this.motion.deviceMotionActive; }
  get latest(): NativeMotionSample | null { return this.sample; }
  onUpdate(listener: (sample: NativeMotionSample) => void): () => void {
    this.assertLive(); this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  /** False means the physical gyro/device-motion service is unavailable (e.g. simulator). */
  start(): boolean {
    this.assertLive();
    if (!this.available) return false;
    this.requested = true;
    if (!this.suspended) this.begin();
    return true;
  }
  stop(): void { this.requested = false; this.end(); }
  setUpdateInterval(ms: number): void {
    this.assertLive(); this.interval = validateMotionInterval(ms);
    if (this.running) this.motion.deviceMotionUpdateInterval = this.interval / 1000;
  }
  setScreenRotation(rotation: MotionScreenRotation): void {
    this.assertLive(); this.rotation = validateScreenRotation(rotation);
    this.sample = null;
  }
  /** Call once per Engine update. No event is emitted until a new sensor timestamp arrives. */
  update(deltaMs: number): NativeMotionSample | null {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Motion deltaMs must be finite and non-negative.');
    if (this.disposed || !this.running || this.suspended) return null;
    const reading = this.motion.deviceMotion;
    if (!reading || reading.timestamp <= this.timestampFloor || (this.lastTimestamp !== null && reading.timestamp <= this.lastTimestamp)) return null;
    const sample = createMotionSample(reading, deltaMs,
      this.lastTimestamp === null ? 0 : (reading.timestamp - this.lastTimestamp) * 1000, this.rotation);
    this.lastTimestamp = reading.timestamp; this.sample = sample;
    for (const listener of [...this.listeners]) {
      if (!this.running || this.disposed) break;
      if (this.listeners.has(listener)) listener(sample);
    }
    return sample;
  }
  readonly suspend = (): void => { this.suspended = true; this.end(); };
  readonly resume = (): void => {
    if (this.disposed) return;
    this.suspended = false;
    if (this.requested) this.begin();
  };
  readonly dispose = (): void => {
    if (this.disposed) return;
    this.stop(); this.disposed = true; this.listeners.clear();
    Application.off(Application.suspendEvent, this.suspend);
    Application.off(Application.resumeEvent, this.resume);
    Application.off(Application.exitEvent, this.dispose);
    if (owner === this) owner = null;
  };
  private begin(): void {
    if (this.running) return;
    this.timestampFloor = this.motion.deviceMotion?.timestamp ?? -Infinity;
    try {
      if (!(CMMotionManager.availableAttitudeReferenceFrames() & X_ARBITRARY_Z_VERTICAL))
        throw new Error('The gravity-aligned attitude reference frame is unavailable.');
      this.motion.deviceMotionUpdateInterval = this.interval / 1000;
      this.motion.startDeviceMotionUpdatesUsingReferenceFrame(X_ARBITRARY_Z_VERTICAL);
    } catch (error) { this.requested = false; this.motion.stopDeviceMotionUpdates(); this.end(); throw error; }
    this.running = true;
  }
  private end(): void {
    if (this.running) this.motion.stopDeviceMotionUpdates();
    this.running = false; this.lastTimestamp = null; this.sample = null;
  }
  private assertLive(): void { if (this.disposed) throw new Error('NativeDeviceMotion is disposed.'); }
}
