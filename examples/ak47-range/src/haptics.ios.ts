/** Shot-synchronous recoil, with hit feedback taking priority; no timer survives suspension. */
export class RangeHaptics {
  private light: UIImpactFeedbackGenerator | null = null;
  private medium: UIImpactFeedbackGenerator | null = null;
  private active = false;
  private lastShot = -Infinity;
  private lastHit = -Infinity;
  private shots = 0;
  private hits = 0;
  resume(): void {
    this.light ??= UIImpactFeedbackGenerator.alloc().initWithStyle(UIImpactFeedbackStyle.Light);
    this.medium ??= UIImpactFeedbackGenerator.alloc().initWithStyle(UIImpactFeedbackStyle.Medium);
    this.active = true; this.light.prepare(); this.medium.prepare();
  }
  impact(kind: 'shot' | 'hit'): void {
    if (!this.active) return;
    const now = NSProcessInfo.processInfo.systemUptime * 1000;
    if (kind === 'shot') {
      if (now - this.lastShot < 75 || now - this.lastHit < 140) return;
      this.lastShot = now; this.light?.impactOccurred(); this.light?.prepare(); this.shots++;
    } else {
      if (now - this.lastHit < 120) return;
      this.lastHit = now; this.medium?.impactOccurred(); this.medium?.prepare(); this.hits++;
    }
  }
  suspend(): void { this.active = false; }
  dispose(): void { this.suspend(); this.light = null; this.medium = null; }
  snapshot() { return { active: this.active, recoilPulses: this.shots, hitPulses: this.hits }; }
}
