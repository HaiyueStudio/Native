/// <reference path="./native.d.ts" />
import { StoreFailure, type StoreGateway, type VerifiedAccess } from './controller';
import { StoreRequests } from './requests';
import { validateStoreConfig, type StoreConfig } from './config';

export class NativeStore implements StoreGateway {
  private readonly requests = new StoreRequests();
  private readonly native: HYNonConsumableStore;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly config: StoreConfig) { validateStoreConfig(config); this.native = HYNonConsumableStore.alloc().initWithProductIDOnChange(this.config.productId, () => { for (const listener of this.listeners) listener(); }); }
  private call(action: string): Promise<Record<string, unknown>> {
    return this.requests.call(action, complete => this.native.callCompletion(action, complete));
  }
  async product() { const p = await this.call('product'); if (typeof p.price !== 'string' || !p.price) throw new StoreFailure('unavailable'); return { price: p.price, purchasable: p.purchasable === true }; }
  async access(restore: boolean): Promise<VerifiedAccess> { const a = await this.call(restore ? 'restore' : 'access'); return { owned: a.owned === true, revoked: a.revoked === true }; }
  async purchase(): Promise<'changed' | 'cancelled' | 'pending'> { const a = await this.call('purchase'); if (a.result === 'changed' || a.result === 'cancelled' || a.result === 'pending') return a.result; throw new StoreFailure('error'); }
  onChange(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  dispose(): void { this.listeners.clear(); this.requests.dispose(); this.native.dispose(); }
}
