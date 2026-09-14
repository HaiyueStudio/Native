export type NativeImpact = 'light' | 'medium' | 'heavy';

/** Reusable iOS impact feedback. Call from the main-thread game/lifecycle callbacks. */
export class NativeHaptics {
  private light: UIImpactFeedbackGenerator | null = null;
  private medium: UIImpactFeedbackGenerator | null = null;
  private heavy: UIImpactFeedbackGenerator | null = null;
  private active = false;
  private disposed = false;
  private lastImpactMs = -Infinity;
  private lastKind: NativeImpact = 'light';
  private count = 0;

  resume(): void {
    if (this.disposed) return;
    this.active = true;
    this.light ??= UIImpactFeedbackGenerator.alloc().initWithStyle(UIImpactFeedbackStyle.Light);
    this.medium ??= UIImpactFeedbackGenerator.alloc().initWithStyle(UIImpactFeedbackStyle.Medium);
    this.heavy ??= UIImpactFeedbackGenerator.alloc().initWithStyle(UIImpactFeedbackStyle.Heavy);
    this.light.prepare(); this.medium.prepare(); this.heavy.prepare();
  }
  impact(kind: NativeImpact): void {
    if (!this.active || this.disposed) return;
    const now = NSProcessInfo.processInfo.systemUptime * 1000;
    // Suppress clusters while allowing a stronger impact to supersede a softer cue.
    const priority = { light: 0, medium: 1, heavy: 2 };
    if (now - this.lastImpactMs < 250 && priority[kind] <= priority[this.lastKind]) return;
    this.lastImpactMs = now; this.lastKind = kind;
    const generator = kind === 'heavy' ? this.heavy : kind === 'medium' ? this.medium : this.light;
    generator?.impactOccurred(); generator?.prepare(); this.count++;
  }
  suspend(): void { this.active = false; }
  dispose(): void { this.suspend(); this.disposed = true; this.light = null; this.medium = null; this.heavy = null; }
  snapshot() { return { active: this.active, impactsRequested: this.count, lastKind: this.lastKind }; }
}
