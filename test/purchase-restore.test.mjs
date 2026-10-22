import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

function ios(){
 const calls=[],owned=new Set(),pending=[],cache=new Map();
 let failure=null,hold=false;
 const native={alloc:()=>({initWithProductIDOnChange(id,changed){return {
  callCompletion(action,complete){
   calls.push({id,action});
   const respond=()=>complete(JSON.stringify(action==='product'?{price:'$2.99',purchasable:true}:
    action==='restore'&&failure?{error:failure}:{owned:owned.has(id)}));
   if(action==='restore'&&hold)pending.push(respond);else respond();
  },dispose(){},
 };}})};
 const globals={HYNonConsumableStore:native};
 const {NativeStore}=loadTS('bridge/purchases/store.ios.ts',{},globals,cache);
 const {PurchaseController}=loadTS('bridge/purchases/controller.ts',{},globals,cache);
 const {PurchaseCatalog}=loadTS('bridge/purchases/catalog.ts',{},globals,cache);
 const stores=Object.fromEntries(['basic','advanced','full','upgrade'].map(id=>[id,new PurchaseController(new NativeStore({productId:id,storageNamespace:'restore-test'}))]));
 const catalog=new PurchaseCatalog(Object.entries(stores).map(([id,store])=>({id,store,grants:id==='full'?['basic','advanced']:id==='upgrade'?['advanced']:[id],...(id==='upgrade'?{requires:['basic']}:{})})),[{id:'full',requires:['basic','advanced']}]);
 return {calls,owned,stores,catalog,set failure(v){failure=v;},set hold(v){hold=v;},finish(){pending.splice(0).forEach(fn=>fn());},dispose(){catalog.dispose();Object.values(stores).forEach(s=>s.dispose());}};
}
const syncs=f=>f.calls.filter(c=>c.action==='restore');

test('four real iOS controllers synchronize the account once, then verify every other product silently',async()=>{
 const f=ios();f.owned.add('full');
 await f.catalog.restore();
 assert.equal(syncs(f).length,1);assert.equal(syncs(f)[0].id,'basic','the first offer need not be owned');
 assert.deepEqual(f.calls.filter(c=>c.action==='access').map(c=>c.id),['advanced','full','upgrade']);
 assert(f.catalog.snapshot().entitlements.includes('full'));assert.equal(f.catalog.snapshot().busy,false);
 await f.catalog.restore();assert.equal(syncs(f).length,2,'a later explicit restore is allowed');
 f.dispose();
});

test('account sync never grants unverified packs and restored upgrades still require the base pack',async()=>{
 const f=ios();f.owned.add('upgrade');await f.catalog.restore();
 assert.equal(f.catalog.snapshot().entitlements.length,0);
 f.owned.add('basic');await f.catalog.restore();assert(f.catalog.snapshot().entitlements.includes('full'));
 f.owned.delete('basic');await f.catalog.refresh();assert.equal(f.catalog.snapshot().entitlements.length,0);
 assert.equal(syncs(f).length,2,'ordinary refresh is silent');f.dispose();
});

test('cancelling account authentication stops the catalog, preserves verified ownership and permits explicit retry',async()=>{
 const f=ios();f.owned.add('basic');await f.catalog.refresh();f.calls.length=0;f.failure='cancelled';
 await f.catalog.restore();assert.equal(syncs(f).length,1);assert.equal(f.calls.filter(c=>c.action==='access').length,0);
 assert.equal(f.stores.basic.snapshot().phase,'cancelled');assert.equal(f.catalog.snapshot().busy,false);
 assert(f.catalog.snapshot().entitlements.includes('basic'));
 f.failure=null;await f.catalog.restore();assert.equal(syncs(f).length,2);assert.equal(f.stores.basic.snapshot().phase,'restored');f.dispose();
});

test('failed synchronization is not retried per product, but verified cached rights may still be refreshed',async()=>{
 const f=ios();f.owned.add('full');f.failure='offline';
 await f.catalog.restore();assert.equal(syncs(f).length,1);
 assert.equal(f.stores.basic.snapshot().phase,'offline');assert(f.catalog.snapshot().entitlements.includes('full'));
 assert.equal(f.catalog.snapshot().busy,false);f.dispose();
});

test('rapid repeated restore taps cannot launch another authentication operation',async()=>{
 const f=ios();f.hold=true;const first=f.catalog.restore();
 assert.equal(f.catalog.snapshot().busy,true);
 const repeated=Array.from({length:20},()=>f.catalog.restore());
 await tick();assert.equal(syncs(f).length,1);f.finish();await Promise.all([first,...repeated]);
 assert.equal(syncs(f).length,1);assert.equal(f.catalog.snapshot().busy,false);f.dispose();
});

test('unscoped gateways keep per-product restoration and distinct scopes each synchronize once',async()=>{
 const {PurchaseCatalog}=loadTS('bridge/purchases/catalog.ts'),scopeA={},scopeB={},calls=[];
 const offers=[undefined,undefined,scopeA,scopeA,scopeB,scopeB].map((restoreScope,i)=>({id:String(i),grants:[String(i)],store:{
  ...(restoreScope?{restoreScope}:{}),snapshot:()=>({busy:false,entitled:false,phase:'ready'}),
  subscribe:()=>()=>{},restore:async()=>{calls.push(`restore:${i}`);},refresh:async()=>{calls.push(`refresh:${i}`);},
 }}));
 const catalog=new PurchaseCatalog(offers);await catalog.restore();
 assert.deepEqual(calls,['restore:0','restore:1','restore:2','refresh:3','restore:4','refresh:5']);catalog.dispose();
});
