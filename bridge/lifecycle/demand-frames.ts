export interface DemandFrameDriver {
  start(): void;
  stop(): void;
  defer(callback: () => void): void;
}

/** Event-driven ownership of Engine.run/stop. No polling timer or idle RAF.
 * Two frames cover GUI callbacks that mutate a scene after its 3D pass. */
export class NativeDemandFrames {
  private readonly driver: DemandFrameDriver;
  private remaining = 0;
  private active = false;
  private running = false;
  private queued = false;
  private disposed = false;
  constructor(driver: DemandFrameDriver) { this.driver = driver; }

  request(): void {
    if (this.disposed) return;
    this.remaining = 2;
    if (!this.active || this.running || this.queued) return;
    this.queued = true;
    // Never restart synchronously inside after-update: FrameLoop's current tick
    // would otherwise schedule a second RAF after start() scheduled the first.
    this.driver.defer(() => {
      this.queued = false;
      if (!this.active || this.disposed || this.running) return;
      this.running = true;
      this.driver.start();
    });
  }
  resume(): void { if (!this.disposed) { this.active = true; this.request(); } }
  suspend(): void {
    this.active = false;
    this.running = false;
    this.remaining = 0;
    this.driver.stop();
  }
  afterFrame(animating: boolean): void {
    if (!this.active || this.disposed) return;
    // Render a settling frame even if a deadline expires between update and
    // presentation; final static colors/poses must reach the surface.
    this.remaining = animating ? 2 : Math.max(0, this.remaining - 1);
    if (!animating && this.remaining === 0) {
      this.running = false;
      this.driver.stop();
    }
  }
  snapshot() { return { active: this.active, running: this.running, queued: this.queued, remaining: this.remaining }; }
  dispose(): void { this.disposed = true; this.suspend(); }
}
