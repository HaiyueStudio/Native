import { Application, Utils } from '@nativescript/core';
import { createMotionSample, validateMotionInterval, validateScreenRotation,
  type NativeMotionSample, type MotionScreenRotation, type MotionReading, type MotionVector } from './motion-sample';
import { androidMotionReading } from './android-reading';
export type { NativeMotionSample, MotionScreenRotation } from './motion-sample';
export interface NativeDeviceMotionOptions { updateIntervalMs?: number; screenRotation?: MotionScreenRotation }
let owner: NativeDeviceMotion | null = null;
/** Sensor callbacks only copy data. Game events are delivered from the existing Engine update. */
export class NativeDeviceMotion {
  private readonly manager: android.hardware.SensorManager;
  private readonly sensors: (android.hardware.Sensor | null)[];
  private readonly listener: android.hardware.SensorEventListener;
  private readonly listeners = new Set<(sample: NativeMotionSample) => void>();
  private interval: number;
  private rotation: MotionScreenRotation;
  private requested = false;
  private running = false;
  private suspended = false;
  private disposed = false;
  private lastTimestamp: number | null = null;
  private floor = 0;
  private rate: MotionVector | null = null;
  private acceleration: MotionVector | null = null;
  private reading: MotionReading | null = null;
  private sample: NativeMotionSample | null = null;
  constructor(options: NativeDeviceMotionOptions = {}) {
    this.interval = validateMotionInterval(options.updateIntervalMs ?? 1000 / 60);
    this.rotation = validateScreenRotation(options.screenRotation ?? 0);
    if (owner) throw new Error('Only one NativeDeviceMotion controller may exist per app.');
    this.manager = Utils.android.getApplicationContext().getSystemService(android.content.Context.SENSOR_SERVICE) as android.hardware.SensorManager;
    const S = android.hardware.Sensor;
    this.sensors = [this.manager.getDefaultSensor(S.TYPE_GAME_ROTATION_VECTOR) ?? this.manager.getDefaultSensor(S.TYPE_ROTATION_VECTOR),
      this.manager.getDefaultSensor(S.TYPE_GYROSCOPE), this.manager.getDefaultSensor(S.TYPE_ACCELEROMETER)];
    this.listener = new android.hardware.SensorEventListener({ onAccuracyChanged: () => {}, onSensorChanged: event => {
      const timestamp = event.timestamp / 1e9;
      if (!this.running || this.suspended || timestamp <= this.floor) return;
      const values = event.values;
      const vector = { x: values[0], y: values[1], z: values[2] };
      switch (event.sensor.getType()) {
        case S.TYPE_GYROSCOPE: this.rate = vector; break;
        case S.TYPE_ACCELEROMETER: this.acceleration = vector; break;
        default:
          if (!this.rate || !this.acceleration) return;
          try { this.reading = androidMotionReading(timestamp, Array.from({length: values.length}, (_, i) => values[i]), this.rate, this.acceleration); }
          catch { this.reading = null; }
      }
    } });
    owner = this;
    this.suspended = !!(Application.inBackground || Application.suspended);
    Application.on(Application.suspendEvent, this.suspend);
    Application.on(Application.resumeEvent, this.resume);
    Application.on(Application.exitEvent, this.dispose);
  }
  get available(): boolean { return this.sensors.every(Boolean); }
  get active(): boolean { return this.running; }
  get latest(): NativeMotionSample | null { return this.sample; }
  onUpdate(listener: (sample: NativeMotionSample) => void): () => void {
    this.assertLive(); this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  start(): boolean {
    this.assertLive(); if (!this.available) return false;
    this.requested = true; if (!this.suspended) this.begin(); return true;
  }
  stop(): void { this.requested = false; this.end(); }
  setUpdateInterval(ms: number): void {
    this.assertLive(); this.interval = validateMotionInterval(ms);
    if (this.running) { this.end(); this.begin(); }
  }
  setScreenRotation(rotation: MotionScreenRotation): void {
    this.assertLive(); this.rotation = validateScreenRotation(rotation); this.sample = null;
  }
  update(deltaMs: number): NativeMotionSample | null {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new RangeError('Motion deltaMs must be finite and non-negative.');
    if (this.disposed || !this.running || this.suspended) return null;
    const reading = this.reading;
    if (!reading || (this.lastTimestamp !== null && reading.timestamp <= this.lastTimestamp)) return null;
    const sample = createMotionSample(reading, deltaMs, this.lastTimestamp === null ? 0 : (reading.timestamp - this.lastTimestamp) * 1000, this.rotation);
    this.lastTimestamp = reading.timestamp; this.sample = sample;
    for (const listener of [...this.listeners]) {
      if (!this.running || this.disposed) break;
      if (this.listeners.has(listener)) listener(sample);
    }
    return sample;
  }
  readonly suspend = (): void => { this.suspended = true; this.end(); };
  readonly resume = (): void => { if (!this.disposed) { this.suspended = false; if (this.requested) this.begin(); } };
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
    this.floor = android.os.SystemClock.elapsedRealtimeNanos() / 1e9;
    this.running = true;
    try {
      for (const sensor of this.sensors) if (!sensor || !this.manager.registerListener(this.listener, sensor, Math.round(this.interval * 1000)))
        throw new Error('Android motion sensor registration failed.');
    } catch (error) { this.requested = false; this.end(); throw error; }
  }
  private end(): void {
    if (this.running) this.manager.unregisterListener(this.listener);
    this.running = false; this.lastTimestamp = null; this.sample = null; this.reading = null; this.rate = null; this.acceleration = null;
  }
  private assertLive(): void { if (this.disposed) throw new Error('NativeDeviceMotion is disposed.'); }
}
