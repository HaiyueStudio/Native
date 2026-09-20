import type { VerifiedAccess } from './controller';

export interface GooglePurchase { token: string; purchased: boolean; pending: boolean }
export interface AccessLease { owned: boolean; revoked?: boolean; pending?: boolean; tokenHash: string; issuedAt: number; expiresAt: number }
export interface GoogleAccessDependencies {
  query(): Promise<GooglePurchase[]>;
  verify(token: string): Promise<string>;
  decode(lease: string): AccessLease | null;
  hash(token: string): string;
  read(): string | null;
  write(value: string): void;
  now(): number;
}
/** No cached boolean is trusted: each read checks signature, scope, token and expiry. */
export class GoogleAccess {
  private readonly deps: GoogleAccessDependencies;
  constructor(deps: GoogleAccessDependencies) { this.deps = deps; }
  private cached(): { token: string; lease: AccessLease } | null {
    try {
      const raw = JSON.parse(this.deps.read() ?? 'null');
      if (!raw || typeof raw.token !== 'string' || typeof raw.signed !== 'string' || raw.seenAt > this.deps.now() + 300) return null;
      const lease = this.deps.decode(raw.signed);
      if (!lease || lease.tokenHash !== this.deps.hash(raw.token) || lease.expiresAt <= this.deps.now()) return null;
      this.deps.write(JSON.stringify({ ...raw, seenAt: this.deps.now() }));
      return { token: raw.token, lease };
    } catch { return null; }
  }
  async access(): Promise<VerifiedAccess> {
    const cached = this.cached();
    let purchases: GooglePurchase[];
    try { purchases = await this.deps.query(); }
    catch { return { owned: cached?.lease.owned === true, offline: true, validUntil: cached?.lease.expiresAt }; }
    const owned = purchases.find(p => p.purchased && !p.pending);
    const pending = purchases.some(p => p.pending);
    const token = owned?.token ?? cached?.token;
    if (!token) return { owned: false, pending };
    try {
      const signed = await this.deps.verify(token);
      const lease = this.deps.decode(signed);
      if (!lease || lease.tokenHash !== this.deps.hash(token)) throw new Error('Invalid signed entitlement');
      // Store query and online verification both succeeded. An empty inventory
      // (for example after changing Play accounts) must not inherit old access.
      if (!owned && !pending && lease.owned) { this.deps.write('null'); return { owned: false }; }
      this.deps.write(JSON.stringify({ token, signed, seenAt: this.deps.now() }));
      return { owned: lease.owned && !!owned, pending: pending || lease.pending, revoked: lease.revoked, validUntil: lease.expiresAt };
    } catch {
      // In-flight callbacks cannot invent ownership. Only the already verified,
      // unexpired offline lease can survive a disconnected backend/store.
      return { owned: cached?.lease.owned === true, offline: true, pending, validUntil: cached?.lease.expiresAt };
    }
  }
}
