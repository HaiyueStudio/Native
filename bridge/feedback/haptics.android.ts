import { Utils } from '@nativescript/core';
export type NativeImpact = 'light' | 'medium' | 'heavy';
/** Requires the normal (non-prompting) android.permission.VIBRATE manifest permission. */
export class NativeHaptics {
  private vibrator: android.os.Vibrator | null = null;
  private active = false;
  private disposed = false;
  private lastImpactMs = -Infinity;
  private lastKind: NativeImpact = 'light';
  private count = 0;
  resume(): void {
    if (this.disposed) return;
    this.vibrator ??= Utils.android.getApplicationContext().getSystemService(android.content.Context.VIBRATOR_SERVICE) as android.os.Vibrator;
    this.active = true;
  }
  impact(kind: NativeImpact): void {
    if (!this.active || this.disposed || !this.vibrator?.hasVibrator()) return;
    const now = android.os.SystemClock.uptimeMillis();
    const priority = { light: 0, medium: 1, heavy: 2 };
    if (now - this.lastImpactMs < 250 && priority[kind] <= priority[this.lastKind]) return;
    const [duration, amplitude] = { light: [12, 55], medium: [24, 120], heavy: [40, 210] }[kind];
    if (android.os.Build.VERSION.SDK_INT >= 26) {
      const strength = this.vibrator.hasAmplitudeControl() ? amplitude : android.os.VibrationEffect.DEFAULT_AMPLITUDE;
      this.vibrator.vibrate(android.os.VibrationEffect.createOneShot(duration, strength));
    } else this.vibrator.vibrate(duration);
    this.lastImpactMs = now; this.lastKind = kind; this.count++;
  }
  suspend(): void { this.active = false; this.vibrator?.cancel(); }
  dispose(): void { if (this.disposed) return; this.suspend(); this.disposed = true; this.vibrator = null; }
  snapshot() { return { active: this.active, impactsRequested: this.count, lastKind: this.lastKind }; }
}
