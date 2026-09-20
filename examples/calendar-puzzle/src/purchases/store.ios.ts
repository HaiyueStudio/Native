import { StoreFailure, type StoreGateway, type VerifiedAccess } from '../../../../bridge/purchases/controller';
import { CALENDAR_STORE } from './config';

export class CalendarStore implements StoreGateway {
  private readonly native: HYCalendarStore;
  private readonly listeners = new Set<() => void>();
  constructor() { this.native = HYCalendarStore.alloc().initWithProductIDOnChange(CALENDAR_STORE.productId, () => { for (const listener of this.listeners) listener(); }); }
  private call(action: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => this.native.callCompletion(action, json => {
      try {
        const value = JSON.parse(json);
        if (value.error && value.error !== 'cancelled') reject(new StoreFailure(value.error === 'offline' ? 'offline' : value.error === 'unavailable' ? 'unavailable' : 'error'));
        else if (value.error === 'cancelled' && action !== 'purchase') reject(new StoreFailure('cancelled'));
        else resolve(value);
      } catch { reject(new StoreFailure('error')); }
    }));
  }
  async product() { const p = await this.call('product'); if (typeof p.price !== 'string' || !p.price) throw new StoreFailure('unavailable'); return { price: p.price, purchasable: p.purchasable === true }; }
  async access(restore: boolean): Promise<VerifiedAccess> { const a = await this.call(restore ? 'restore' : 'access'); return { owned: a.owned === true, revoked: a.revoked === true }; }
  async purchase(): Promise<'changed' | 'cancelled' | 'pending'> { const a = await this.call('purchase'); if (a.result === 'changed' || a.result === 'cancelled' || a.result === 'pending') return a.result; throw new StoreFailure('error'); }
  onChange(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  dispose(): void { this.listeners.clear(); this.native.dispose(); }
}
