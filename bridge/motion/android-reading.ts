import type { MotionReading, MotionVector } from './motion-sample';
/** Android rotation vectors describe device-to-world rotation; gravity points down, in g. */
export function androidMotionReading(timestamp: number, vector: readonly number[], rotationRate: MotionVector, acceleration: MotionVector): MotionReading {
  let [x, y, z, w = Math.sqrt(Math.max(0, 1 - vector[0] ** 2 - vector[1] ** 2 - vector[2] ** 2))] = vector;
  const length = Math.hypot(x, y, z, w);
  if (!Number.isFinite(length) || length < 1e-8) throw new RangeError('Invalid Android rotation vector.');
  x /= length; y /= length; z /= length; w /= length;
  const gravity = { x: -2 * (x * z - w * y), y: -2 * (y * z + w * x), z: -(1 - 2 * (x * x + y * y)) };
  return { timestamp, attitude: {
    pitch: Math.asin(Math.max(-1, Math.min(1, 2 * (w * x - y * z)))),
    roll: Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y)),
    yaw: Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z)),
    quaternion: { x, y, z, w },
  }, gravity, rotationRate: { ...rotationRate }, userAcceleration: {
    x: acceleration.x / 9.80665 + gravity.x,
    y: acceleration.y / 9.80665 + gravity.y,
    z: acceleration.z / 9.80665 + gravity.z,
  } };
}
