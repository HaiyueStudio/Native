import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './support/load-ts.mjs';
import { readFileSync } from 'node:fs';

const { createAchievements, createLocalAchievementProvider, AchievementError } = loadTS('bridge/achievements/index.ts', {}, { AbortController });
const catalog = () => ({ schemaVersion: 1, gameId: 'test-game', environment: 'test', version: '1', definitions: [
  { id: 'solves', target: 10, titleKey: 'solves.title', descriptionKey: 'solves.description' },
  { id: 'secret', target: 2, titleKey: 'secret.title', descriptionKey: 'secret.description', hidden: true },
] });
const clone = x => JSON.parse(JSON.stringify(x));
test('version 1 JSON contract fixtures load without Engine and require explicit target migration', async () => {
  const { validateCatalog, validateSnapshot } = loadTS('bridge/achievements/core/catalog.ts');
  const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/achievements/${name}.json`, import.meta.url), 'utf8'));
  const cat = validateCatalog(fixture('catalog-v1'));
  assert.equal(validateSnapshot(fixture('snapshot-v1'), cat).records.length, 2);
  cat.definitions[1].target = 20;
  assert.throws(() => validateSnapshot(fixture('snapshot-v1'), cat), /target changed/);
});
function storage() {
  const values = new Map();
  return { values, fail: false, async read(key) { return values.has(key) ? clone(values.get(key)) : null; },
    async write(key, value) { if (this.fail) throw new Error('disk full'); values.set(key, clone(value)); } };
}
function remote() {
  let session = { state: 'ready', playerId: 'A' };
  const listeners = new Set(), calls = [], values = new Map();
  return { kind: 'steam', applicationId: 'test-app', calls, values,
    capabilities: { authentication: true, query: true, persistentProgress: true, nativeUI: false, remoteSync: true },
    async initialize() {}, getSession: () => ({ ...session }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    change(next) { session = next; for (const fn of listeners) fn(); },
    async load(context) { assert.equal(context.session.playerId, session.playerId); return values.get(session.playerId) ?? []; },
    async report(progress, context) { assert.equal(context.session.playerId, session.playerId); calls.push({ progress: clone(progress), player: session.playerId }); },
    dispose() { listeners.clear(); },
  };
}
async function create(overrides = {}) {
  const st = overrides.storage ?? storage(), provider = overrides.provider ?? createLocalAchievementProvider('app');
  const controller = createAchievements({ catalog: catalog(), guestProfile: 'guest-1', storage: st, provider, ...overrides });
  await controller.initialize(); return { controller, storage: st, provider };
}

test('local progress persists, remains local-only, and repeats do not unlock twice', async () => {
  const { controller: c, storage: st } = await create(); const events = [];
  c.subscribe(e => events.push(e)); c.subscribe(() => { throw new Error('consumer'); });
  await c.reportProgress('solves', 6); await c.reportProgress('solves', 3); await c.unlock('solves'); await c.unlock('solves');
  assert.equal(events.filter(e => e.type === 'unlocked-local').length, 1);
  assert.equal((await c.load())[0].value, 10); assert.equal((await c.flush())[0].sync, 'local-only');
  assert.equal(await c.showUI(), 'unsupported'); c.dispose();
  const { controller: restored } = await create({ storage: st }); assert.equal((await restored.load())[0].value, 10); restored.dispose();
});
test('invalid catalog, IDs, platform mappings and progress are rejected', async () => {
  const cat = catalog(); cat.definitions.push(cat.definitions[0]);
  assert.throws(() => createAchievements({ catalog: cat, provider: remote(), storage: storage(), guestProfile: 'guest' }), /Duplicate/);
  const { controller: c } = await create();
  for (const value of [-1, NaN, Infinity, 1.5, 11]) await assert.rejects(c.reportProgress('solves', value), /progress/);
  await assert.rejects(c.unlock('unknown')); c.dispose();
});
test('write failure does not acknowledge, mutate memory, or emit unlocked', async () => {
  const { controller: c, storage: st } = await create(); const events = []; c.subscribe(e => events.push(e));
  st.fail = true; await assert.rejects(c.unlock('solves'), /disk full/);
  assert.equal((await c.load())[0].value, 0); assert.equal(events.length, 0);
  st.fail = false; await c.unlock('solves'); assert.equal(events.filter(e => e.type === 'unlocked-local').length, 1); c.dispose();
});
test('absolute pending intents coalesce and SDK acceptance differs from subsequent reconciliation', async () => {
  const p = remote(); const { controller: c } = await create({ provider: p });
  for (let v = 1; v <= 10; v++) await c.reportProgress('solves', v);
  assert.equal(p.calls.length, 0); assert.equal((await c.flush())[0].sync, 'provider-accepted');
  assert.deepEqual(p.calls[0].progress, [{ id: 'solves', value: 10 }]);
  await c.flush(); assert.equal(p.calls.length, 1);
  p.values.set('A', [{ id: 'solves', value: 10 }]); assert.equal((await c.load())[0].sync, 'reconciled'); c.dispose();
});
test('read-before-write preserves higher platform progress and suppresses stale reports', async () => {
  const p = remote(); const { controller: c } = await create({ provider: p });
  await c.reportProgress('solves', 3); p.values.set('A', [{ id: 'solves', value: 8 }]);
  const state = await c.flush(); assert.equal(state[0].value, 8); assert.equal(p.calls.length, 0); c.dispose();
});
test('SDK acceptance remains durable and retries after restart until query confirms it', async () => {
  let now = 1000; const st = storage(), p = remote();
  const { controller: first } = await create({ storage: st, provider: p, clock: () => now });
  await first.unlock('solves'); await first.flush(); first.dispose();
  const p2 = remote(); const { controller: second } = await create({ storage: st, provider: p2, clock: () => now });
  await second.flush(); assert.equal(p2.calls.length, 0);
  now = 6000; await second.flush(); assert.equal(p2.calls.length, 1);
  p2.values.set('A', [{ id: 'solves', value: 10 }]);
  const record = (await second.load())[0]; assert.equal(record.sync, 'reconciled'); assert.equal(record.pending, false);
  now = 20000; await second.flush(); assert.equal(p2.calls.length, 1); second.dispose();
});
test('secret achievements do not report partial progress', async () => {
  const p = remote(); const { controller: c } = await create({ provider: p });
  await c.reportProgress('secret', 1); await c.flush(); assert.equal(p.calls.length, 0);
  await c.unlock('secret'); await c.flush(); assert.deepEqual(p.calls[0].progress, [{ id: 'secret', value: 2 }]); c.dispose();
});
test('offline pending intents survive restart and reconnect without guest import', async () => {
  const st = storage(), p = remote(); p.change({ state: 'offline', playerId: 'A' });
  const { controller: c } = await create({ storage: st, provider: p }); await c.reportProgress('solves', 4); await c.flush();
  assert.equal(p.calls.length, 0); c.dispose();
  const p2 = remote(); const { controller: c2 } = await create({ storage: st, provider: p2 }); await c2.flush();
  assert.deepEqual(p2.calls[0].progress, [{ id: 'solves', value: 4 }]); c2.dispose();
  const guest = remote(); guest.change({ state: 'guest' }); const { controller: c3 } = await create({ storage: st, provider: guest });
  await c3.unlock('solves'); guest.change({ state: 'ready', playerId: 'B' });
  assert.equal((await c3.load())[0].value, 0); await c3.flush(); assert.equal(guest.calls.length, 0); c3.dispose();
});
test('account switch aborts stalled request and rejects late completion', async () => {
  const p = remote(); let finish, entered;
  const started = new Promise(r => { entered = r; });
  p.report = async () => { entered(); return new Promise(r => { finish = r; }); };
  const { controller: c } = await create({ provider: p }); await c.unlock('solves');
  const flushing = c.flush(); await started;
  p.change({ state: 'ready', playerId: 'B' }); await assert.rejects(flushing, /session/i);
  finish(); assert.equal((await c.load())[0].value, 0);
  p.change({ state: 'ready', playerId: 'A' }); assert.equal((await c.load())[0].sync, 'queued'); c.dispose();
});
test('queued operation captures caller identity instead of adopting a later account', async () => {
  const p = remote(); const { controller: c } = await create({ provider: p });
  const progress = c.unlock('solves'); p.change({ state: 'ready', playerId: 'B' });
  await assert.rejects(progress, /session/i); assert.equal((await c.load())[0].value, 0); c.dispose();
});
test('retry backoff persists; permanent errors do not retry even on larger values', async () => {
  let now = 1000; const p = remote(); let count = 0;
  p.report = async () => { count++; throw new Error('offline'); };
  const { controller: c } = await create({ provider: p, clock: () => now });
  await c.reportProgress('solves', 1); assert.equal((await c.flush())[0].sync, 'failed'); await c.flush(); assert.equal(count, 1);
  now = 2000; await c.flush(); assert.equal(count, 2);
  p.report = async () => { count++; throw new AchievementError('invalid-app', 'No configured app'); };
  now = 4000; await c.flush(); await c.reportProgress('solves', 2); now = 999999; await c.flush(); assert.equal(count, 3); c.dispose();
});
test('hanging provider times out while pending state remains durable', async () => {
  const p = remote(); p.report = async () => new Promise(() => {});
  const { controller: c } = await create({ provider: p, operationTimeoutMs: 15 }); await c.unlock('solves');
  const records = await c.flush(); assert.equal(records[0].pending, true); assert.equal(records[0].code, 'retryable'); c.dispose();
});
test('dispose aborts pending provider operation and silences late callbacks', async () => {
  const p = remote(); let entered; const ready = new Promise(r => { entered = r; });
  p.report = async () => { entered(); return new Promise(() => {}); };
  const { controller: c } = await create({ provider: p }); await c.unlock('solves'); const events = []; c.subscribe(e => events.push(e));
  const work = c.flush(); await ready; const beforeDispose = events.length; c.dispose(); c.dispose(); await assert.rejects(work, /disposed/i); assert.equal(events.length, beforeDispose);
});
test('catalog changes require explicit validated migration, never silently lower target', async () => {
  const st = storage(); const { controller: c } = await create({ storage: st }); await c.reportProgress('solves', 5); c.dispose();
  const changed = catalog(); changed.version = '2'; changed.definitions[0].target = 4;
  await assert.rejects(create({ storage: st, catalog: changed }), /migration/i);
  const { controller: migrated } = await create({ storage: st, catalog: changed, migrate: (old, cat) => ({ ...old, catalogVersion: cat.version,
    targets: { ...old.targets, solves: 4 }, records: old.records.map(r => r.id === 'solves' ? { ...r, value: 0, platformValue: 0, pending: false, sync: 'local-only' } : r) }) });
  assert.equal((await migrated.load())[0].value, 0); migrated.dispose();
});
test('corrupt storage fails closed; caller snapshots do not mutate internal state', async () => {
  const st = storage(); const { controller: c } = await create({ storage: st }); await c.reportProgress('solves', 1);
  const data = await c.load(); data[0].value = 10; assert.equal((await c.load())[0].value, 1); c.dispose();
  const [key, saved] = [...st.values][0]; saved.records[0].value = -1; st.values.set(key, saved);
  await assert.rejects(create({ storage: st }), /record/i);
});
test('environment and guest profile are distinct storage namespaces', async () => {
  const st = storage(); const { controller: c } = await create({ storage: st }); await c.unlock('solves'); c.dispose();
  const { controller: second } = await create({ storage: st, guestProfile: 'guest-2' }); assert.equal((await second.load())[0].value, 0); second.dispose();
  const cat = catalog(); cat.environment = 'production'; const { controller: third } = await create({ storage: st, catalog: cat });
  assert.equal((await third.load())[0].value, 0); third.dispose();
});
