/** SDK-independent daily allowances and durable, idempotent rewarded credits.
 * One controller per namespaced storage key. Never share a key between games. */
export type RewardPhase = 'ready' | 'loading' | 'earned' | 'cancelled' | 'unavailable' | 'offline' | 'error' | 'limit';
export interface RewardSnapshot {
  unlimited: boolean; free: number; credits: number; adsRemaining: number;
  busy: boolean; phase: RewardPhase; privacyRequired: boolean;
  initializing: boolean; presenting: boolean; operation: 'ad' | 'privacy' | 'consent' | null;
}
export interface RewardPresentation { prepare(): Promise<boolean>; closed(): void; }
export interface RewardGateway {
  initialize?(presentForm: boolean, beforePresent: () => Promise<boolean>): Promise<void>;
  show(earned: () => void, presentation: RewardPresentation): Promise<void>;
  privacy(presentation: RewardPresentation): Promise<void>;
  privacyRequired(): boolean;
  dispose(): void;
}
export interface RewardStorage { read(): string | null; write(value: string): void; }
interface Wallet { version: 1; day: string; used: number; ads: number; credits: number; sequence: number; rewarded: number; hints: string[]; }
export class RewardController {
  private wallet!: Wallet;
  private phase: RewardPhase = 'ready';
  private busy = false;
  private disposed = false;
  private broken = false;
  private listeners = new Set<() => void>();
  private initialization?: Promise<void>;
  private initializing: boolean;
  private presenting = false;
  private operation: RewardSnapshot['operation'] = null;
  constructor(private readonly options: {
    storage: RewardStorage; gateway: RewardGateway; entitled: () => boolean;
    dailyFree: number; dailyAds: number; pause: () => (() => void) | Promise<() => void>; now?: () => Date;
  }) {
    this.initializing = !!options.gateway.initialize;
    if (![options.dailyFree, options.dailyAds].every(n => Number.isSafeInteger(n) && n >= 0)) throw Error('Invalid daily allowance');
    try {
      const raw = options.storage.read();
      const data = raw === null ? this.empty() : JSON.parse(raw);
      if (data.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(data.day) ||
        !['used','ads','credits','sequence','rewarded'].every(k => Number.isSafeInteger(data[k]) && data[k] >= 0) ||
        data.rewarded > data.sequence || !Array.isArray(data.hints) || !data.hints.every((k: unknown) => typeof k === 'string')) throw Error('Invalid wallet');
      this.wallet = data;
      this.rollover();
    } catch { this.broken = true; this.phase = 'error'; this.wallet ??= this.empty(); }
  }
  private day(): string {
    const date = this.options.now?.() ?? new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  private empty(): Wallet { return { version:1, day:this.day(), used:0, ads:0, credits:0, sequence:0, rewarded:0, hints:[] }; }
  private save(next: Wallet): boolean {
    try { this.options.storage.write(JSON.stringify(next)); this.wallet = next; return true; }
    catch { this.broken = true; this.phase = 'error'; return false; }
  }
  private rollover(): void {
    const day = this.day();
    // Moving the clock backwards cannot refill an already used day.
    if (!this.broken && day > this.wallet.day && this.save({ ...this.wallet, day, used:0, ads:0, hints:[] }) && !this.busy) this.phase = 'ready';
  }
  snapshot(): RewardSnapshot {
    this.rollover();
    return { unlimited:this.options.entitled(), free:this.broken ? 0 : Math.max(0,this.options.dailyFree-this.wallet.used),
      credits:this.broken ? 0 : this.wallet.credits, adsRemaining:this.broken ? 0 : Math.max(0,this.options.dailyAds-this.wallet.ads),
      busy:this.busy, phase:this.phase, privacyRequired:this.options.gateway.privacyRequired(),
      initializing:this.initializing, presenting:this.presenting, operation:this.operation };
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  refresh(): void { this.rollover(); this.emit(); }
  /** Startup failure must leave normal play and the wallet intact. */
  initialize(): Promise<void> {
    if (this.disposed || !this.options.gateway.initialize) return Promise.resolve();
    return this.initialization ??= this.initializeConsent();
  }
  private async initializeConsent(): Promise<void> {
    if (this.busy) { this.initializing = false; this.emit(); return; }
    let presenting = false;
    let resume = () => {};
    try {
      await this.options.gateway.initialize!(!this.options.entitled(), async () => {
        // A silent network refresh must not stop calendar, paywall or puzzle input.
        // Explicit ad/privacy work takes precedence and will collect consent itself.
        if (this.disposed || this.busy || this.options.entitled()) return false;
        presenting = true; this.busy = true; this.operation = 'consent'; this.presenting = true; this.emit();
        const pause = this.options.pause();
        resume = typeof pause === 'function' ? pause : await pause;
        return !this.disposed;
      });
    } catch { /* Retry through the next explicit ad/privacy request. */ }
    finally {
      this.initializing = false;
      if (presenting) { this.busy = false; this.presenting = false; this.operation = null; resume(); }
      this.emit();
    }
  }
  private presentation(): { hooks: RewardPresentation; release(): void } {
    let active = true, resume: (() => void) | undefined;
    let preparing: Promise<boolean> | undefined;
    const close = () => {
      preparing = undefined;
      this.presenting = false;
      const release = resume; resume = undefined; release?.(); this.emit();
    };
    return {
      hooks: {
        prepare: () => preparing ??= (async () => {
          if (!active || this.disposed) return false;
          this.presenting = true; this.emit();
          const release = await this.options.pause();
          if (!active || this.disposed) { release(); return false; }
          resume = release; return true;
        })(),
        closed: close,
      },
      release: () => { active = false; close(); },
    };
  }
  private emit(): void { if (!this.disposed) for (const listener of this.listeners) listener(); }
  /** Call only once a useful result is ready. The same result key is free to redisplay. */
  consume(key: string): boolean {
    if (this.disposed || !key) return false;
    if (this.options.entitled()) return true;
    const state = this.snapshot();
    if (this.broken || this.busy) return false;
    if (this.wallet.hints.includes(key)) return true;
    if (!state.free && !state.credits) return false;
    const ok = this.save({ ...this.wallet, used:this.wallet.used + (state.free ? 1 : 0), credits:this.wallet.credits - (state.free ? 0 : 1), hints:[...this.wallet.hints, key] });
    this.emit(); return ok;
  }
  async watch(): Promise<void> {
    if (this.disposed || this.busy || this.options.entitled() || this.broken) return;
    if (!this.snapshot().adsRemaining) { this.phase = 'limit'; this.emit(); return; }
    const sequence = this.wallet.sequence + 1;
    if (!this.save({ ...this.wallet, sequence })) { this.emit(); return; }
    this.busy = true; this.operation = 'ad'; this.phase = 'loading'; this.emit();
    const presentation = this.presentation();
    let earned = false, ended = false;
    try {
      if (this.disposed) return;
      await this.options.gateway.show(() => {
        // Google-earned events precede dismissal. Stale/duplicate callbacks never mint credits.
        if (ended || earned || this.wallet.rewarded >= sequence) return;
        this.rollover();
        earned = this.save({ ...this.wallet, rewarded:sequence, credits:this.wallet.credits+1, ads:this.wallet.ads+1 });
        this.phase = earned ? 'earned' : 'error'; this.emit();
      }, presentation.hooks);
      if (!this.broken) this.phase = earned ? 'earned' : 'cancelled';
    } catch (error) {
      if (!earned && !this.broken) this.phase = error instanceof Error && ['offline','unavailable'].includes(error.message) ? error.message as RewardPhase : 'error';
    } finally { ended = true; this.busy = false; this.operation = null; presentation.release(); this.emit(); }
  }
  async privacy(): Promise<void> {
    if (this.disposed || this.busy) return;
    this.busy = true; this.operation = 'privacy'; this.phase = 'loading'; this.emit();
    const presentation = this.presentation();
    try {
      if (this.disposed) return;
      await this.options.gateway.privacy(presentation.hooks); this.phase = 'ready';
    }
    catch { this.phase = 'error'; }
    finally { this.busy = false; this.operation = null; presentation.release(); this.emit(); }
  }
  dispose(): void { this.disposed = true; this.listeners.clear(); this.options.gateway.dispose(); }
}
