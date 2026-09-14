export type SteeringMode = 'joystick' | 'gyro';

/** UIKit landscape names are opposite to clockwise rotation of the motion axes. */
export function landscapeMotionRotation(side: 'left' | 'right'): 90 | 270 {
  return side === 'left' ? 270 : 90;
}

/** Neutral hand position is captured at race entry/resume; two degrees suppress hand tremor. */
export class TiltSteering {
  private neutral: number | null = null;
  private value = 0;
  reset(): void { this.neutral = null; this.value = 0; }
  update(rightDegrees: number, deltaMs: number): number {
    if (!Number.isFinite(rightDegrees)) return this.value;
    this.neutral ??= rightDegrees;
    const angle = rightDegrees - this.neutral;
    const magnitude = Math.max(0, Math.abs(angle) - 2) / 22;
    // Positive screen-right tilt turns right; the racing rules use positive for left.
    const target = -Math.sign(angle) * Math.min(1, magnitude);
    this.value += (target - this.value) * (1 - Math.exp(-Math.max(0, Math.min(100, deltaMs)) / 75));
    return this.value;
  }
  get axis(): number { return this.value; }
}
