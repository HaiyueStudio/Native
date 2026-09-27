import type { Purchases, PurchaseState } from './types';

export interface PurchaseOffer {
  id: string;
  store: Purchases;
  /** Entitlements granted by this non-consumable. */
  grants: readonly string[];
  /** Verified entitlements required for an upgrade, including after restoration. */
  requires?: readonly string[];
}
export interface EntitlementBundle { id: string; requires: readonly string[]; }
export interface CatalogSnapshot {
  busy: boolean;
  entitlements: string[];
  offers: { id: string; state: PurchaseState; eligible: boolean; canPurchase: boolean }[];
}
export type CatalogPurchaseResult = 'requested' | 'ineligible' | 'unavailable' | 'owned' | 'busy' | 'disposed';
/** Store-neutral bundle/upgrade policy. Prices belong to separately configured
 * store products, never to client-side subtraction of localized strings.
 * Requires verified base ownership even for restored upgrade transactions. */
export class PurchaseCatalog {
  private readonly offers: PurchaseOffer[];
  private readonly bundles: EntitlementBundle[];
  private readonly listeners = new Set<() => void>();
  private readonly removers: (()=>void)[];
  private busy = false;
  private disposed = false;
  constructor(offers: readonly PurchaseOffer[], bundles: readonly EntitlementBundle[] = []) {
    if (!offers.length || new Set(offers.map(o=>o.id)).size!==offers.length || new Set(offers.map(o=>o.store)).size!==offers.length) throw Error('Duplicate or empty purchase catalog');
    if (new Set(bundles.map(b=>b.id)).size!==bundles.length) throw Error('Duplicate entitlement bundle');
    for(const o of offers) if (!o.id || !o.grants.length || [...o.grants,...o.requires??[]].some(s=>!s)) throw Error('Invalid offer');
    for(const b of bundles) if(!b.id || !b.requires.length || b.requires.includes(b.id) || b.requires.some(s=>!s)) throw Error('Invalid entitlement bundle');
    this.offers=offers.map(o=>({...o,grants:[...o.grants],requires:[...o.requires??[]]}));
    this.bundles=bundles.map(b=>({...b,requires:[...b.requires]}));
    this.removers=this.offers.map(o=>o.store.subscribe(()=>this.emit()));
  }
  snapshot(): CatalogSnapshot {
    const states=this.offers.map(o=>o.store.snapshot()), rights=new Set<string>();
    let changed=true;
    while(changed){
      const size=rights.size;
      this.offers.forEach((o,i)=>{if(states[i].entitled && (o.requires??[]).every(r=>rights.has(r)))o.grants.forEach(r=>rights.add(r));});
      this.bundles.forEach(b=>{if(b.requires.every(r=>rights.has(r)))rights.add(b.id);});
      changed=rights.size!==size;
    }
    const busy=this.busy||states.some(s=>s.busy);
    return {busy,entitlements:[...rights].sort(),offers:this.offers.map((o,i)=>{
      const state=states[i],eligible=(o.requires??[]).every(r=>rights.has(r));
      return {id:o.id,state,eligible,canPurchase:!this.disposed&&!busy&&eligible&&!state.entitled&&!o.grants.every(r=>rights.has(r))&&!!state.price&&state.canPurchase&&!['pending','loading'].includes(state.phase)};
    })};
  }
  subscribe(listener:()=>void):()=>void { this.listeners.add(listener);return()=>{this.listeners.delete(listener);}; }
  private emit():void { if(!this.disposed)for(const listener of this.listeners)listener(); }
  async purchase(id:string):Promise<CatalogPurchaseResult>{
    if(this.disposed)return 'disposed';
    const offer=this.offers.find(o=>o.id===id);if(!offer)throw Error('Unknown purchase offer');
    if(this.snapshot().busy)return 'busy';
    this.busy=true;this.emit();
    try {
      // Recheck prerequisites before opening native checkout, not just when drawing UI.
      for(const o of this.offers)await o.store.refresh();
      if(this.disposed)return 'disposed';
      const snap=this.snapshot(),current=snap.offers.find(o=>o.id===id)!;
      if(current.state.entitled||offer.grants.every(r=>snap.entitlements.includes(r)))return 'owned';
      if(!current.eligible)return 'ineligible';
      if(!current.state.price||!current.state.canPurchase||['loading','pending','offline','error','unavailable'].includes(current.state.phase))return 'unavailable';
      await offer.store.purchase();return 'requested';
    } finally {this.busy=false;this.emit();}
  }
  async refresh():Promise<void>{await this.reconcile(false);}
  async restore():Promise<void>{await this.reconcile(true);}
  private async reconcile(restore:boolean):Promise<void>{
    if(this.disposed||this.snapshot().busy)return;
    this.busy=true;this.emit();
    try{for(const o of this.offers){if(this.disposed)break;try{await (restore?o.store.restore():o.store.refresh());}catch{/* Other products can still restore. */}}}
    finally{this.busy=false;this.emit();}
  }
  /** Controllers remain owned by the host, which disposes them separately. */
  dispose():void{this.disposed=true;this.removers.forEach(remove=>remove());this.listeners.clear();}
}
