import { CubeModel, inverse, scramble } from './model';
import type { Kind, Move } from './model';
export interface Turn {
  move: Move;
  elapsed: number;
  duration: number;
  undo: boolean;
  source?: 'manual' | 'scramble' | 'assisted';
}
export interface CubeSolve { kind: Kind; seconds: number }
/** Serial animation transactions: commit rules/history only when a turn finishes. */
export class CubeSession {
  model: CubeModel;
  active: Turn | null = null;
  private queue: Move[] = [];
  restoring = false;
  private challenge = false;
  private scrambling = false;
  private elapsed = 0;
  constructor(kind: Kind, private readonly onSolved?: (result: CubeSolve) => void) {
    this.model = new CubeModel(kind);
  }
  get busy(): boolean {
    return !!this.active || this.queue.length > 0 || this.restoring;
  }
  get remaining(): number {
    return this.restoring ? this.model.history.length : this.queue.length + Number(!!this.active);
  }
  turn(move: Move): boolean {
    if (this.busy) return false;
    this.active = { move: { ...move }, elapsed: 0, duration: 0.22, undo: false, source: 'manual' };
    return true;
  }
  shuffle(seed: number): void {
    if (!this.busy) { this.queue = scramble(this.model.order, seed); this.challenge = false; this.scrambling = true; this.elapsed = 0; }
  }
  restore(): void {
    if (!this.busy && this.model.history.length) { this.restoring = true; this.challenge = false; }
  }
  stop(): void {
    this.queue = [];
    this.restoring = false;
    this.challenge = false; this.scrambling = false;
  }
  undo(): void {
    const last = this.model.history[this.model.history.length - 1];
    if (!this.busy && last) { this.challenge = false; this.active = { move: inverse(last), elapsed: 0, duration: 0.22, undo: true, source: 'assisted' }; }
  }
  update(delta: number): boolean {
    let changed = false;
    if (this.challenge && Number.isFinite(delta)) this.elapsed += Math.max(0, delta);
    if (!this.active) {
      const last = this.model.history[this.model.history.length - 1];
      if (this.restoring && !last) this.restoring = false;
      const move = this.restoring && last ? inverse(last) : this.queue.shift();
      if (move)
        this.active = { move, elapsed: 0, duration: this.restoring ? 0.1 : 0.075, undo: this.restoring, source: this.restoring ? 'assisted' : 'scramble' };
    }
    if (this.active) {
      this.active.elapsed += Math.max(0, Math.min(delta, 0.05));
      if (this.active.elapsed >= this.active.duration) {
        const source = this.active.source;
        if (this.active.undo) this.model.undo();
        else this.model.apply(this.active.move);
        this.active = null;
        changed = true;
        if (this.restoring && !this.model.history.length) this.restoring = false;
        if (this.scrambling && this.queue.length === 0) { this.scrambling = false; this.challenge = !this.model.solved; this.elapsed = 0; }
        else if (source === 'manual' && this.challenge && this.model.solved) {
          this.challenge = false; this.onSolved?.({ kind: this.model.kind, seconds: this.elapsed });
        }
      }
    }
    return changed;
  }
}
