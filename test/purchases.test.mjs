import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './support/load-ts.mjs';
const { PurchaseController, StoreFailure } = loadTS('bridge/purchases/controller.ts');
const { GoogleAccess } = loadTS('bridge/purchases/google-access.ts');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function store() {
  const s = { owned: false, result: 'changed', listener: () => {}, buys: 0, reads: 0, restores: 0,
    product: async () => ({ price: '￥300', purchasable: true }),
    access: async restore => { s.reads++; if (restore) s.restores++; return { owned: s.owned }; },
    purchase: async () => { s.buys++; return s.result; },
    onChange: fn => { s.listener = fn; return () => { s.listener = () => {}; }; }, dispose() {},
  }; return s;
}
test('localized price, verified purchase and explicit restore', async () => {
  const s = store(), c = new PurchaseController(s);
  await c.refresh(); assert.equal(c.snapshot().price, '￥300'); assert.equal(c.snapshot().entitled, false);
  s.owned = true; await c.purchase(); assert.equal(c.snapshot().entitled, true);
  await c.restore(); assert.equal(s.restores, 1); assert.equal(c.snapshot().phase, 'restored');
});
test('cancel/pending never unlock and duplicate taps launch checkout once', async () => {
  for (const result of ['cancelled', 'pending']) {
    const s = store(); s.result = result; const c = new PurchaseController(s);
    await Promise.all([c.purchase(), c.purchase(), c.purchase()]);
    assert.equal(s.buys, 1); assert.equal(c.snapshot().phase, result); assert.equal(c.snapshot().entitled, false);
  }
});
test('refresh disables controls synchronously and repeated UI refresh taps do not enqueue another request', async () => {
  const s = store();let finish;
  s.product = () => new Promise(resolve => { finish = resolve; });
  const c = new PurchaseController(s);const first = c.refresh();
  assert.equal(c.snapshot().busy, true);assert.equal(c.snapshot().phase, 'loading');
  for(let i=0;i<20;i++)assert.equal(c.refresh(), first);
  await tick();finish({ price: '¥18', purchasable: true });await first;await tick();
  assert.equal(s.reads, 1);assert.equal(c.snapshot().busy, false);
});
test('repeated store callbacks coalesce, pending completion is verified, refund removes access', async () => {
  const s = store(), c = new PurchaseController(s);
  s.result = 'pending'; await c.purchase();
  s.owned = true;
  for (let i = 0; i < 20; i++) s.listener();
  await tick(); await tick();
  assert.equal(c.snapshot().entitled, true); assert.ok(s.reads <= 2);
  s.owned = false; s.listener(); await tick();
  assert.equal(c.snapshot().entitled, false); assert.equal(c.snapshot().phase, 'revoked');
  c.dispose(); s.owned = true; s.listener(); await tick(); assert.equal(c.snapshot().entitled, false);
});
test('store outage does not create entitlement or show a fabricated price', async () => {
  const s = store(); s.product = async () => { throw new StoreFailure('offline'); };
  const c = new PurchaseController(s); await c.refresh();
  assert.equal(c.snapshot().price, null); assert.equal(c.snapshot().canPurchase, false); assert.equal(c.snapshot().phase, 'offline');
  await c.restore(); assert.equal(c.snapshot().entitled, false);
});
test('verified offline owner keeps access when product pricing is unavailable; empty refreshed inventory revokes it', async () => {
  const s = store(); s.owned = true;
  const c = new PurchaseController(s); await c.refresh();
  s.product = async () => { throw new StoreFailure('offline'); };
  await c.refresh();
  assert.equal(c.snapshot().entitled, true);
  assert.equal(c.snapshot().price, null);
  assert.equal(c.snapshot().canPurchase, false);
  s.owned = false; await c.refresh();
  assert.equal(c.snapshot().entitled, false);
  assert.equal(c.snapshot().phase, 'revoked');
  c.dispose();
});
test('cancelled restore keeps verified ownership and releases loading controls for retry', async () => {
  const s = store(); s.owned = true;
  const c = new PurchaseController(s); await c.refresh();
  const access = s.access;
  s.access = async restore => { if (restore) throw new StoreFailure('cancelled'); return access(false); };
  await c.restore();
  assert.equal(c.snapshot().entitled, true);
  assert.equal(c.snapshot().phase, 'cancelled');
  assert.equal(c.snapshot().busy, false);
  s.access = access; await c.restore();
  assert.equal(c.snapshot().phase, 'restored');
  c.dispose();
});
test('store callback arriving during restore triggers one subsequent entitlement read', async () => {
  const s = store(); let finish;
  s.access = async restore => {
    s.reads++;
    if (restore) return new Promise(resolve => { finish = resolve; });
    return { owned: s.owned };
  };
  const c = new PurchaseController(s);
  const restoring = c.restore(); await tick();
  for (let i = 0; i < 20; i++) s.listener();
  assert.equal(c.snapshot().busy, true);
  s.owned = true; finish({ owned: true }); await restoring; await tick(); await tick();
  assert.equal(s.reads, 2);
  assert.equal(c.snapshot().entitled, true);
  assert.equal(c.snapshot().busy, false);
  c.dispose();
});
test('lease expiry locks without relying on a rendering or network loop', async () => {
  const s = store(); s.access = async () => ({ owned: true, validUntil: Date.now() / 1000 - 1 });
  const c = new PurchaseController(s); await c.refresh(); assert.equal(c.snapshot().entitled, false);
});
function google() {
  const g = { time: 1000, cache: null, online: true, backend: true, records: [{ token: 'token-one', purchased: true, pending: false }],
    lease: { owned: true, tokenHash: 'hash:token-one', issuedAt: 1000, expiresAt: 2000 },
    calls: 0,
  };
  const access = new GoogleAccess({ now: () => g.time, read: () => g.cache, write: v => { g.cache = v; }, hash: t => 'hash:' + t,
    query: async () => { if (!g.online) throw Error(); return g.records; },
    verify: async () => { g.calls++; if (!g.backend) throw Error(); return 'signed:' + JSON.stringify(g.lease); },
    decode: s => { if (!s.startsWith('signed:')) return null; const v = JSON.parse(s.slice(7)); return v.expiresAt > g.time ? v : null; },
  }); return { g, access };
}
test('offline cache requires validated grant, unexpired lease and matching token', async () => {
  const { g, access } = google();
  g.online = false; assert.equal((await access.access()).owned, false);
  g.online = true; assert.equal((await access.access()).owned, true);
  g.online = false; assert.equal((await access.access()).owned, true);
  const original = g.cache; g.cache = original.replace('"token":"token-one"', '"token":"stolen"');
  assert.equal((await access.access()).owned, false);
  g.cache = original; g.time = 2100; assert.equal((await access.access()).owned, false);
  g.time = 500; assert.equal((await access.access()).owned, false);
});
test('backend outage never grants a first purchase; pending never grants access', async () => {
  const { g, access } = google(); g.backend = false;
  assert.equal((await access.access()).owned, false);
  g.records = [{ token: 'token-one', purchased: false, pending: true }];
  const result = await access.access(); assert.equal(result.owned, false); assert.equal(result.pending, true);
});
test('online refund persists locked state when later offline, restore can recover', async () => {
  const { g, access } = google(); await access.access();
  g.records = []; g.lease = { ...g.lease, owned: false, revoked: true };
  let result = await access.access(); assert.equal(result.owned, false); assert.equal(result.revoked, true);
  g.online = false; assert.equal((await access.access()).owned, false);
  g.online = true; g.records = [{ token: 'token-one', purchased: true, pending: false }];
  g.lease = { ...g.lease, owned: true, revoked: false }; assert.equal((await access.access()).owned, true);
});
test('empty online inventory does not inherit a different store account purchase', async () => {
  const { g, access } = google(); await access.access(); g.records = [];
  assert.equal((await access.access()).owned, false); assert.equal(g.cache, 'null');
});

test('successful empty/pending inventory clears previous account lease even during backend outage', async () => {
  for (const records of [[], [{ token: 'pending-other', purchased: false, pending: true }]]) {
    const { g, access } = google(); await access.access();
    g.backend = false; g.records = records;
    assert.equal((await access.access()).owned, false); assert.equal(g.cache, 'null');
    g.online = false; assert.equal((await access.access()).owned, false);
  }
});
test('a different purchase token cannot reuse cached ownership during backend outage', async () => {
  const { g, access } = google(); await access.access();
  g.records = [{ token: 'other-owner', purchased: true, pending: false }]; g.backend = false;
  assert.equal((await access.access()).owned, false);
  g.online = false; assert.equal((await access.access()).owned, false);
});
test('native request disposal rejects pending calls and ignores late or duplicate completions', async () => {
  const { StoreRequests } = loadTS('bridge/purchases/requests.ts');
  const requests = new StoreRequests(); let complete;
  const operation = requests.call('restore', callback => { complete = callback; });
  requests.dispose(); await assert.rejects(operation, /unavailable/);
  complete('{"owned":true}');
  await assert.rejects(requests.call('access', () => assert.fail('disposed dispatch')), /unavailable/);
});
test('native reply parsing distinguishes cancelled checkout, cancelled restore and malformed replies', async () => {
  const { StoreRequests } = loadTS('bridge/purchases/requests.ts');
  const r = new StoreRequests();
  assert.equal((await r.call('purchase', done => done('{"error":"cancelled"}'))).result, 'cancelled');
  await assert.rejects(r.call('restore', done => done('{"error":"cancelled"}')), /cancelled/);
  for (const reply of ['null', '[]', '{bad', '{"error":"internal"}']) await assert.rejects(r.call('access', done => done(reply)), /error/);
});
