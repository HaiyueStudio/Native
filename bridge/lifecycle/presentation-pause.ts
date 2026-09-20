/** Reconciles OS backgrounding with overlapping native full-screen presentations. */
export class PresentationPause {
  private background = false;
  private tokens = new Set<object>();
  private paused = false;
  constructor(private readonly suspend: () => void, private readonly resume: () => void) {}
  setBackground(value: boolean): void { this.background = value; this.sync(); }
  acquire(): () => void {
    const token = {}; this.tokens.add(token); this.sync();
    return () => { this.tokens.delete(token); this.sync(); };
  }
  private sync(): void {
    const paused = this.background || this.tokens.size > 0;
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) this.suspend(); else this.resume();
  }
}
