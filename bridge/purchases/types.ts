/** Store-neutral UI contract. Only a native verifier can grant the entitlement. */
export type PurchasePhase = 'loading' | 'ready' | 'purchasing' | 'restoring' | 'pending' | 'cancelled' | 'offline' | 'unavailable' | 'error' | 'revoked' | 'restored' | 'empty';
export interface PurchaseState {
  readonly entitled: boolean;
  readonly phase: PurchasePhase;
  readonly price: string | null;
  readonly canPurchase: boolean;
  readonly busy: boolean;
}
export interface Purchases {
  snapshot(): PurchaseState;
  subscribe(listener: () => void): () => void;
  purchase(): Promise<void>;
  restore(): Promise<void>;
  refresh(): Promise<void>;
}
