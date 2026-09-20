import { Application, ApplicationSettings, Http } from '@nativescript/core';
import { StoreFailure, type StoreGateway, type VerifiedAccess } from '../../../../bridge/purchases/controller';
import { GoogleAccess, type GooglePurchase, type AccessLease } from '../../../../bridge/purchases/google-access';
import { CALENDAR_STORE } from './config';

const CACHE = 'calendar.store.google.verified.v1';
const INSTALLATION = 'calendar.store.installation.v1';
export class CalendarStore implements StoreGateway {
  private readonly native: org.haiyue.calendarstore.HYCalendarBilling;
  private readonly listeners = new Set<() => void>();
  private readonly accessService: GoogleAccess;
  private readonly configured = /^https:\/\//.test(CALENDAR_STORE.verificationUrl) && CALENDAR_STORE.verificationPublicKey.includes('BEGIN PUBLIC KEY');
  constructor() {
    const Bridge = org.haiyue.calendarstore.HYCalendarBilling;
    this.native = new Bridge(Application.android.context, CALENDAR_STORE.productId, new Bridge.Listener({ changed: () => { for (const listener of this.listeners) listener(); } }));
    let installation = ApplicationSettings.getString(INSTALLATION);
    if (!installation) { installation = java.util.UUID.randomUUID().toString(); ApplicationSettings.setString(INSTALLATION, installation); }
    const installationId = installation;
    this.accessService = new GoogleAccess({
      query: async () => (await this.call('access')).purchases as GooglePurchase[],
      verify: async purchaseToken => {
        if (!this.configured) throw new StoreFailure('unavailable');
        const response = await Http.request({ url: CALENDAR_STORE.verificationUrl, method: 'POST', timeout: 15000,
          headers: { 'Content-Type': 'application/json' }, content: JSON.stringify({ purchaseToken, installationId, productId: CALENDAR_STORE.productId }) });
        if (response.statusCode !== 200) throw new StoreFailure('offline');
        const value = response.content?.toJSON();
        if (typeof value?.lease !== 'string') throw new StoreFailure('error');
        return value.lease;
      },
      decode: signed => {
        try { return JSON.parse(Bridge.verifyLease(signed, CALENDAR_STORE.verificationPublicKey, CALENDAR_STORE.productId, CALENDAR_STORE.androidPackage, installationId, Math.floor(Date.now() / 1000))) as AccessLease | null; }
        catch { return null; }
      },
      hash: token => Bridge.tokenHash(token),
      read: () => ApplicationSettings.getString(CACHE) ?? null,
      write: value => ApplicationSettings.setString(CACHE, value),
      now: () => Math.floor(Date.now() / 1000),
    });
  }
  private call(action: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => this.native.call(action, Application.android.foregroundActivity ?? Application.android.startActivity, new org.haiyue.calendarstore.HYCalendarBilling.Completion({ complete: json => {
      try {
        const value = JSON.parse(json);
        if (value.error) reject(new StoreFailure(value.error === 'cancelled' ? 'cancelled' : value.error === 'offline' ? 'offline' : value.error === 'unavailable' ? 'unavailable' : 'error'));
        else resolve(value);
      } catch { reject(new StoreFailure('error')); }
    } })));
  }
  async product() { const p = await this.call('product'); if (typeof p.price !== 'string' || !p.price) throw new StoreFailure('unavailable'); return { price: p.price, purchasable: this.configured }; }
  access(_restore: boolean): Promise<VerifiedAccess> { return this.accessService.access(); }
  async purchase(): Promise<'changed' | 'cancelled' | 'pending'> {
    if (!this.configured) throw new StoreFailure('unavailable');
    const p = await this.call('purchase');
    if (p.result === 'changed' || p.result === 'cancelled' || p.result === 'pending') return p.result;
    throw new StoreFailure('error');
  }
  onChange(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  dispose(): void { this.listeners.clear(); this.native.dispose(); }
}
