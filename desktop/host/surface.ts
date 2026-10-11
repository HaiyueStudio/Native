/** Acquire before invoking game callbacks: a transient swapchain failure must not consume a RAF. */
export class SurfaceLease {
  private configuration?: GPUCanvasConfiguration;
  private texture?: GPUTexture;
  private failures = 0;
  skipped = 0;
  constructor(private context: GPUCanvasContext, private presentSurface: () => void) {}
  configure(configuration: GPUCanvasConfiguration) {
    if (this.texture) throw new Error('Cannot configure an acquired surface');
    this.context.configure(configuration); this.configuration = configuration;
  }
  acquire(focused = true): boolean {
    if (this.texture) return true;
    if (!this.configuration) return false;
    try {
      this.texture = this.context.getCurrentTexture(); this.failures = 0; return true;
    } catch (error) {
      // Deno 2.9.6 collapses recoverable wgpu acquisition statuses into this message.
      // Device loss and other errors remain fatal; never fabricate a GPU texture.
      if (!(error instanceof Error) || error.message !== 'Invalid Surface Status') throw error;
      this.skipped++;
      if (focused && ++this.failures >= 120) throw new Error('Native surface unavailable for 120 foreground attempts', { cause: error });
      if (!focused) this.failures = 0;
      this.context.configure(this.configuration);
      return false;
    }
  }
  current(): GPUTexture {
    if (!this.texture) throw new Error('Surface must be acquired before rendering');
    return this.texture;
  }
  present(): boolean {
    if (!this.texture) return false;
    try { this.presentSurface(); return true; } finally { this.texture = undefined; }
  }
  unconfigure() {
    this.texture = undefined; this.configuration = undefined; this.context.unconfigure();
  }
}
