import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './support/load-ts.mjs';
const { createSteamAchievementProvider } = loadTS('bridge/achievements/steam/index.ts');
const { createGameCenterAchievementProvider } = loadTS('bridge/achievements/game-center/index.ts');
const catalog = () => ({ schemaVersion: 1, gameId: 'test', environment: 'test', version: '1', definitions: [
  { id: 'count', target: 10, titleKey: 'count', descriptionKey: 'count', platform: { steam: { achievementId: 'COUNT', progressStat: 'COUNT_STAT' }, gameCenter: { achievementId: 'count' } } },
  { id: 'secret', target: 2, titleKey: 'secret', descriptionKey: 'secret', hidden: true, platform: { steam: { achievementId: 'SECRET', progressStat: 'SECRET_STAT' }, gameCenter: { achievementId: 'secret' } } },
] });
function setup(kind) {
  let session = { state: 'ready', playerId: '76561198000000001' };
  const calls = [], ctx = { session: { ...session, provider: kind, generation: 1 }, signal: new AbortController().signal };
  const client = { nativeUI: true, initialize: async () => {}, getSession: () => session, subscribe: () => () => {}, dispose() {},
    read: async (_player, id) => ({ unlocked: false, value: id === 'COUNT' ? 8 : 0 }), store: async (...args) => calls.push(args),
    load: async () => [{ achievementId: 'count', percent: 85 }], report: async (...args) => calls.push(args), showUI: async () => {},
  };
  const provider = kind === 'steam' ? createSteamAchievementProvider({ appId: '480', catalog: catalog(), client }) : createGameCenterAchievementProvider({ bundleId: 'org.haiyue.test', catalog: catalog(), client });
  return { provider, client, calls, ctx, change: () => { session = { ...session, playerId: 'other' }; } };
}
for (const kind of ['steam', 'game-center']) {
  test(`${kind}: read-before-write preserves higher progress, hidden partial stays local`, async () => {
    const { provider: p, calls, ctx } = setup(kind);
    await p.report([{ id: 'count', value: 2 }, { id: 'secret', value: 1 }], ctx);
    assert.equal(calls.length, 1); assert.equal(calls[0][1].length, 1);
    assert.equal(calls[0][1][0][kind === 'steam' ? 'value' : 'percent'], kind === 'steam' ? 8 : 85);
    await p.report([{ id: 'secret', value: 2 }], ctx);
    assert.equal(calls[1][1][0][kind === 'steam' ? 'unlock' : 'percent'], kind === 'steam' ? true : 100);
    p.dispose(); await assert.rejects(p.load(ctx), /cancelled|changed/);
  });
  test(`${kind}: account changes during read never write to the new player`, async () => {
    const { provider: p, client, calls, ctx, change } = setup(kind);
    if (kind === 'steam') client.read = async () => { change(); return { unlocked: false, value: 0 }; };
    else client.load = async () => { change(); return []; };
    await assert.rejects(p.report([{ id: 'count', value: 10 }], ctx), /changed/); assert.equal(calls.length, 0);
  });
  test(`${kind}: abort, invalid progress and SDK errors propagate`, async () => {
    const { provider: p, client, ctx } = setup(kind);
    await assert.rejects(p.report([{ id: 'count', value: 11 }], ctx), /Invalid/);
    await assert.rejects(p.report([{ id: 'count', value: 1 }, { id: 'count', value: 1 }], ctx), /Invalid/);
    const abort = new AbortController(); abort.abort(); await assert.rejects(p.load({ ...ctx, signal: abort.signal }), /cancelled|changed/);
    client[kind === 'steam' ? 'store' : 'report'] = async () => { throw new Error('SDK callback rejected'); };
    await assert.rejects(p.report([{ id: 'count', value: 10 }], ctx), /SDK callback/);
  });
}
test('Steam validates int32 targets, unique platform stats and identifiers; SteamID remains a string', async () => {
  const { client, provider, ctx } = setup('steam');
  const make = c => createSteamAchievementProvider({ appId: '480', catalog: c, client });
  const c = catalog(); c.definitions[0].target = 0x80000000; assert.throws(() => make(c), /target|int32/);
  c.definitions[0].target = 10; delete c.definitions[0].platform.steam.progressStat; assert.throws(() => make(c), /stat/);
  const same = catalog(); same.definitions[1].platform.steam.achievementId = 'COUNT'; assert.throws(() => make(same), /Duplicate|Unique/);
  assert.equal(provider.getSession().playerId, ctx.session.playerId); assert.equal(provider.capabilities.nativeUI, false);
});
test('Game Center conversion does not unlock at 99.999%, and ignores unrelated configured achievements', async () => {
  const { provider, client, ctx } = setup('game-center');
  client.load = async () => [{ achievementId: 'count', percent: 99.99999 }, { achievementId: 'another-game-entry', percent: 100 }];
  assert.equal((await provider.load(ctx))[0].value, 9);
  client.load = async () => [{ achievementId: 'count', percent: 100 }]; assert.equal((await provider.load(ctx))[0].value, 10);
  client.load = async () => [{ achievementId: 'count', percent: NaN }]; await assert.rejects(provider.load(ctx), /Invalid/);
});
test('Steam full stat without the unlock bit does not acknowledge completion or drop the retry', async () => {
  const { provider, client, ctx, calls } = setup('steam');
  client.read = async () => ({ unlocked: false, value: 10 });
  assert.equal((await provider.load(ctx))[0].value, 9);
  await provider.report([{ id: 'count', value: 10 }], ctx);
  assert.equal(calls[0][1][0].unlock, true);
  client.read = async () => ({ unlocked: true, value: 10 });
  assert.equal((await provider.load(ctx))[0].value, 10);
  provider.dispose();
});
test('GameKit queue aborts independently, ignores late callbacks, and disposes listeners/timer', async () => {
  let tick, request, stopped = false, cleared = false, events = [];
  const { createGameCenterQueueClient } = loadTS('bridge/achievements/game-center/queue-client.ts', {}, { setInterval: fn => { tick = fn; return 1; }, clearInterval: () => { cleared = true; } });
  const client = createGameCenterQueueClient({ start() {}, session: () => JSON.stringify({ state: 'ready', playerId: 'A' }),
    request: q => { request = JSON.parse(q); return true; }, poll: () => { const value = JSON.stringify(events); events = []; return value; }, stop() { stopped = true; } });
  await client.initialize('org.test'); const abort = new AbortController();
  const old = client.load('A', abort.signal), id = request.id; abort.abort(); await assert.rejects(old, /cancelled/);
  const next = client.load('A', new AbortController().signal), nextId = request.id;
  events = [{ id, value: [{ achievementId: 'old', percent: 100 }] }, { id: nextId, value: [] }]; tick();
  assert.equal((await next).length, 0); client.dispose(); assert.ok(stopped && cleared);
  await assert.rejects(client.load('A', new AbortController().signal), /changed/);
});
