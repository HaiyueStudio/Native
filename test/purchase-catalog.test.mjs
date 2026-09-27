import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';
const {PurchaseCatalog}=loadTS('bridge/purchases/catalog.ts');
function fixture(){
 const make=price=>({state:{entitled:false,phase:'ready',busy:false,canPurchase:true,price},buys:0,snapshot(){return {...this.state};},subscribe(){return()=>{};},async refresh(){},async restore(){},async purchase(){this.buys++;this.state.entitled=true;}});
 const basic=make('$1.99'),advanced=make('$4.99'),full=make('$5.99');
 const catalog=new PurchaseCatalog([{id:'basic',store:basic,grants:['basic']},{id:'advanced',store:advanced,grants:['advanced']},{id:'full',store:full,grants:['basic','advanced']}],[{id:'full',requires:['basic','advanced']}]);
 return {basic,advanced,full,catalog,make};
}
test('separate packs and discounted full purchase yield the same combined entitlement',async()=>{
 const f=fixture();await f.catalog.purchase('basic');assert.deepEqual([...f.catalog.snapshot().entitlements],['basic']);await f.catalog.purchase('advanced');assert.deepEqual([...f.catalog.snapshot().entitlements],['advanced','basic','full']);assert.equal(await f.catalog.purchase('full'),'owned');assert.equal(f.full.buys,0);
 const g=fixture();await g.catalog.purchase('full');assert.equal(await g.catalog.purchase('basic'),'owned');assert.equal(g.catalog.snapshot().offers[2].state.price,'$5.99');
});
test('upgrade requires refreshed base ownership, restore works in any order, refund removes dependent rights',async()=>{
 const f=fixture(),upgrade=f.make('$3.99');const c=new PurchaseCatalog([{id:'upgrade',store:upgrade,requires:['basic'],grants:['advanced']},{id:'basic',store:f.basic,grants:['basic']}],[{id:'full',requires:['basic','advanced']}]);
 assert.equal(await c.purchase('upgrade'),'ineligible');assert.equal(upgrade.buys,0);
 f.basic.state.entitled=true;assert.equal(await c.purchase('upgrade'),'requested');assert(c.snapshot().entitlements.includes('full'));
 f.basic.state.entitled=false;await c.restore();assert(!c.snapshot().entitlements.includes('full'));assert(upgrade.state.entitled);
 f.basic.state.entitled=true;await c.restore();assert(c.snapshot().entitlements.includes('full'));
 f.basic.refresh=async()=>{f.basic.state.entitled=false;};upgrade.state.entitled=false;assert.equal(await c.purchase('upgrade'),'ineligible');
});
test('checkout is globally serialized, pending cannot start a second checkout, disposal closes entry',async()=>{
 const f=fixture();let finish;f.basic.refresh=()=>new Promise(r=>{finish=r;});const buying=f.catalog.purchase('full');assert.equal(await f.catalog.purchase('advanced'),'busy');finish();await buying;assert.equal(f.full.buys,1);
 f.basic.refresh=async()=>{};f.advanced.state.phase='pending';f.full.state.entitled=false;assert.equal(await f.catalog.purchase('advanced'),'unavailable');
 f.catalog.dispose();assert.equal(await f.catalog.purchase('basic'),'disposed');
});
