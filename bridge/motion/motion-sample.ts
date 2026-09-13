export interface MotionVector { readonly x: number; readonly y: number; readonly z: number }
export interface MotionAngles { readonly pitch: number; readonly roll: number; readonly yaw: number }
export interface MotionQuaternion extends MotionVector { readonly w: number }
/** Clockwise rotation of screen axes from the device's portrait axes. */
export type MotionScreenRotation = 0 | 90 | 180 | 270;
export interface MotionReading {
  readonly timestamp: number;
  readonly attitude: MotionAngles & { readonly quaternion: MotionQuaternion };
  readonly rotationRate: MotionVector;
  readonly gravity: MotionVector;
  readonly userAcceleration: MotionVector;
}
export interface NativeMotionSample {
  readonly timestampMs: number;
  readonly deltaMs: number;
  readonly sensorDeltaMs: number;
  readonly angles: MotionAngles;
  readonly radians: MotionAngles;
  readonly quaternion: MotionQuaternion;
  /** Device axes, radians/second. */
  readonly rotationRate: MotionVector;
  /** Device axes, units of g. */
  readonly gravity: MotionVector;
  readonly userAcceleration: MotionVector;
  readonly screenRotation: MotionScreenRotation;
  /** Degrees: positive right/forward means the screen's right/top edge is lower. */
  readonly tilt: { readonly right: number; readonly forward: number; readonly total: number };
}
const DEGREES = 180 / Math.PI;
export function validateMotionInterval(ms: number): number {
  if (!Number.isFinite(ms) || ms < 5 || ms > 1000) throw new RangeError('Motion updateIntervalMs must be between 5 and 1000.');
  return ms;
}
export function validateScreenRotation(rotation: number): MotionScreenRotation {
  if (![0, 90, 180, 270].includes(rotation)) throw new RangeError('Motion screenRotation must be 0, 90, 180 or 270.');
  return rotation as MotionScreenRotation;
}
/** Copy native structs; snapshots never retain mutable Core Motion objects. */
export function createMotionSample(raw: MotionReading, deltaMs: number, sensorDeltaMs: number, rotation: MotionScreenRotation): NativeMotionSample {
  validateScreenRotation(rotation);
  const vector = (v: MotionVector) => Object.freeze({ x: v.x, y: v.y, z: v.z });
  const { pitch, roll, yaw, quaternion: q } = raw.attitude;
  const gravity = vector(raw.gravity), rate = vector(raw.rotationRate), acceleration = vector(raw.userAcceleration);
  const quaternion = Object.freeze({ x: q.x, y: q.y, z: q.z, w: q.w });
  const numbers = [raw.timestamp, deltaMs, sensorDeltaMs, pitch, roll, yaw, ...Object.values(quaternion),
    ...Object.values(gravity), ...Object.values(rate), ...Object.values(acceleration)];
  if (numbers.some(n => !Number.isFinite(n)) || raw.timestamp < 0 || deltaMs < 0 || sensorDeltaMs < 0)
    throw new RangeError('Motion samples must contain finite values and non-negative times.');
  const length = Math.hypot(gravity.x, gravity.y, gravity.z);
  if (length < 1e-8) throw new RangeError('Motion gravity vector is unavailable.');
  const theta = rotation / DEGREES, c = Math.cos(theta), s = Math.sin(theta);
  const x = c * gravity.x - s * gravity.y, y = s * gravity.x + c * gravity.y;
  return Object.freeze({ timestampMs: raw.timestamp * 1000, deltaMs, sensorDeltaMs,
    angles: Object.freeze({ pitch: pitch * DEGREES, roll: roll * DEGREES, yaw: yaw * DEGREES }),
    radians: Object.freeze({ pitch, roll, yaw }), quaternion, rotationRate: rate, gravity, userAcceleration: acceleration,
    screenRotation: rotation, tilt: Object.freeze({
      right: Math.atan2(x, Math.hypot(y, gravity.z)) * DEGREES,
      forward: Math.atan2(y, Math.hypot(x, gravity.z)) * DEGREES,
      total: Math.acos(Math.max(-1, Math.min(1, -gravity.z / length))) * DEGREES,
    }),
  });
}
