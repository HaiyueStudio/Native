import type { CalendarPurchases, CalendarPurchaseState, PurchasePhase } from '../../../Games/games/calendar-puzzle/purchases';

export interface VerifiedAccess { owned: boolean; offline?: boolean; revoked?: boolean; pending?: boolean; validUntil?: number }
export interface StoreGateway {
  product(): Promise<{ price: string; purchasable: boolean }>;
  access(restore: boolean): Promise<VerifiedAccess>;
  purchase(): Promise<'changed' | 'cancelled' | 'pending'>;
  onChange(listener: () => void): () => void;
  dispose(): void;
}
export class StoreFailure extends Error {
  readonly phase: 'offline' | 'unavailable' | 'error' | 'cancelled';
  constructor(phase: 'offline' | 'unavailable' | 'error' | 'cancelled') { super(phase); this.phase = phase; }
}

/** Serializes operations and coalesces duplicate store callbacks. No permanent local boolean. */
export class PurchaseController implements CalendarPurchases {
  private state: CalendarPurchaseState = { entitled: false, phase: 'loading', price: null, canPurchase: false, busy: false };
  private readonly listeners = new Set<() => void>();
  private readonly gateway: StoreGateway;
  private readonly removeStore: () => void;
  private job: Promise<void> | null = null;
  private dirty = false;
  private disposed = false;
  private validUntil = Infinity;
  constructor(gateway: StoreGateway) {
    this.gateway = gateway;
    this.removeStore = gateway.onChange(() => {
      if (this.job) this.dirty = true;
      else void this.refresh();
    });
  }
  snapshot(): CalendarPurchaseState { return this.state.entitled && Date.now() / 1000 >= this.validUntil ? { ...this.state, entitled: false, phase: 'offline' } : { ...this.state }; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private patch(value: Partial<CalendarPurchaseState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...value };
    for (const listener of this.listeners) listener();
  }
  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.job) return this.job;
    return this.run('refresh');
  }
  purchase(): Promise<void> { return this.disposed || this.job ? this.job ?? Promise.resolve() : this.run('purchase'); }
  restore(): Promise<void> { return this.disposed || this.job ? this.job ?? Promise.resolve() : this.run('restore'); }
  private run(action: 'refresh' | 'purchase' | 'restore'): Promise<void> {
    // Set job before any callbacks or async SDK completions can reenter.
    const work = Promise.resolve().then(async () => {
      if (this.disposed) return;
      try {
        if (action === 'purchase') {
          const result = await this.gateway.purchase();
          if (result !== 'changed') { this.patch({ phase: result }); return; }
        }
        await this.reconcile(action === 'restore');
      } catch (error) {
        // A transient error never invents a revocation. Gateways only return
        // offline-owned after revalidating their signed/native cache.
        this.patch({ phase: error instanceof StoreFailure ? error.phase : 'error' });
      } finally { this.patch({ busy: false }); }
    }).finally(() => {
      this.job = null;
      if (this.dirty && !this.disposed) { this.dirty = false; void this.refresh(); }
    });
    this.job = work;
    // Publish disabled/loading synchronously, before another pointer event can run.
    this.patch({ busy: true, phase: action === 'purchase' ? 'purchasing' : action === 'restore' ? 'restoring' : 'loading' });
    return work;
  }
  private async reconcile(restore: boolean): Promise<void> {
    const [product, access] = await Promise.allSettled([this.gateway.product(), this.gateway.access(restore)]);
    if (this.disposed) return;
    this.patch(product.status === 'fulfilled'
      ? { price: product.value.price, canPurchase: product.value.purchasable }
      : { price: null, canPurchase: false });
    if (access.status === 'rejected') throw access.reason;
    const value = access.value;
    this.validUntil = value.validUntil ?? Infinity;
    let phase: PurchasePhase = value.revoked ? 'revoked' : value.offline ? 'offline'
      : this.state.entitled && !value.owned && !value.pending ? 'revoked'
      : value.pending ? 'pending' : restore ? value.owned ? 'restored' : 'empty' : 'ready';
    if (phase === 'ready' && !value.owned && product.status === 'rejected') phase = product.reason instanceof StoreFailure ? product.reason.phase : 'unavailable';
    if (phase === 'ready' && !value.owned && product.status === 'fulfilled' && !product.value.purchasable) phase = 'unavailable';
    this.patch({ entitled: value.owned, phase });
  }
  dispose(): void { this.disposed = true; this.removeStore(); this.listeners.clear(); this.gateway.dispose(); }
}
