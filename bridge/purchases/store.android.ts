/// <reference path="./native.d.ts" />
import { Application, ApplicationSettings, Http } from '@nativescript/core';
import { StoreFailure, type StoreGateway, type VerifiedAccess } from './controller';
import { GoogleAccess, type GooglePurchase, type AccessLease } from './google-access';
import { StoreRequests } from './requests';
import { validateStoreConfig, type StoreConfig } from './config';

export class NativeStore implements StoreGateway {
  private readonly requests = new StoreRequests();
  private readonly native: org.haiyue.purchases.HYPlayBilling;
  private readonly listeners = new Set<() => void>();
  private readonly accessService: GoogleAccess;
  private readonly configured: boolean;
  constructor(private readonly config: StoreConfig) {
    validateStoreConfig(config);
    const CACHE = `${config.storageNamespace}.${config.productId}.google.verified.v1`;
    const INSTALLATION = `${config.storageNamespace}.installation.v1`;
    this.configured = !!config.verificationUrl && !!config.verificationPublicKey;
    const Bridge = org.haiyue.purchases.HYPlayBilling;
    this.native = new Bridge(Application.android.context, this.config.productId, new Bridge.Listener({ changed: () => { for (const listener of this.listeners) listener(); } }));
    let installation = ApplicationSettings.getString(INSTALLATION);
    if (!installation) { installation = java.util.UUID.randomUUID().toString(); ApplicationSettings.setString(INSTALLATION, installation); }
    const installationId = installation;
    this.accessService = new GoogleAccess({
      query: async () => (await this.call('access')).purchases as GooglePurchase[],
      verify: async purchaseToken => {
        if (!this.configured) throw new StoreFailure('unavailable');
        const response = await Http.request({ url: this.config.verificationUrl!, method: 'POST', timeout: 15000,
          headers: { 'Content-Type': 'application/json' }, content: JSON.stringify({ purchaseToken, installationId, productId: this.config.productId }) });
        if (response.statusCode !== 200) throw new StoreFailure(response.statusCode >= 500 ? 'offline' : 'error');
        const value = response.content?.toJSON();
        if (typeof value?.lease !== 'string') throw new StoreFailure('error');
        return value.lease;
      },
      decode: signed => {
        try { return JSON.parse(Bridge.verifyLease(signed, this.config.verificationPublicKey!, this.config.productId, this.config.androidPackage!, installationId, Math.floor(Date.now() / 1000))) as AccessLease | null; }
        catch { return null; }
      },
      hash: token => Bridge.tokenHash(token),
      read: () => ApplicationSettings.getString(CACHE) ?? null,
      write: value => ApplicationSettings.setString(CACHE, value),
      now: () => Math.floor(Date.now() / 1000),
    });
  }
  private call(action: string): Promise<Record<string, unknown>> {
    return this.requests.call(action, complete => this.native.call(action, Application.android.foregroundActivity ?? Application.android.startActivity, new org.haiyue.purchases.HYPlayBilling.Completion({ complete })));
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
  dispose(): void { this.listeners.clear(); this.requests.dispose(); this.native.dispose(); }
}
