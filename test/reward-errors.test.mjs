import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './support/load-ts.mjs';

function fixture(platform = 'ios', onFailure) {
  let callback, online = true, policy = true, nativeCalls = 0;
  class Ads {
    static Events = class { constructor(events) { Object.assign(this, events); } };
    configurePolicy() { return policy; }
    performUnitEvents(action, unit, cb) { nativeCalls++; callback = cb; }
    perform(activity, action, unit, events) { this.performUnitEvents(action, unit, events.onEvent); }
    privacyRequired = false;
    consentRequired = false;
    continuePresentation() {}
    dispose() { callback?.('error:unavailable:{"stage":"lifecycle","code":"disposed"}'); }
  }
  const core = { isIOS: platform === 'ios', isAndroid: platform === 'android', Application: { android: { foregroundActivity: {}, context: {} } },
    Connectivity: { getConnectionType: () => online ? 1 : 0, connectionType: { none: 0 } } };
  const cache = new Map();
  const mocks = { '@nativescript/core': core, '../platform/runtime': { getNativeCapabilities: () => ({rewardedAds:'available'}) } };
  const globals = { HYRewardedAds: Ads, org: { haiyue: { rewards: { HYRewardedAds: Ads } } }, NSBundle: { mainBundle: { objectForInfoDictionaryKey: () => 'Release' } } };
  const { AdMobRewardGateway } = loadTS('bridge/rewards/admob.ts', mocks, globals, cache);
  const { RewardController, RewardError } = loadTS('bridge/rewards/controller.ts', mocks, globals, cache);
  const failures = [];
  const gateway = new AdMobRewardGateway({ iosUnit: 'ca-app-pub-1234567890123456/1234567890', androidUnit: 'ca-app-pub-1234567890123456/1234567890',
    onFailure: f => { failures.push(f); onFailure?.(f); } });
  const controller = new RewardController({ gateway, storage: { read: () => null, write() {} }, entitled: () => false, dailyFree: 1, dailyAds: 2, pause: () => () => {} });
  return { gateway, controller, RewardError, failures, send: value => callback(value), offline: () => { online = false; }, rejectPolicy: () => { policy = false; }, core, calls: () => nativeCalls };
}

for (const platform of ['ios', 'android']) {
  test(`${platform}: Release diagnostics retain SDK codes, sanitize extras, ignore duplicate callbacks and preserve wallet`, async () => {
    const f = fixture(platform, () => { throw Error('logging disk full'); });
    const run = f.controller.watch();
    f.send('error:unavailable:' + JSON.stringify({ stage: 'ad_load', code: 'no_fill', sdk: { domain: 'GoogleAds', code: 1, message: 'secret' }, underlying: { domain: 'transport', code: -1 }, response: 'secret' }));
    f.send('earned'); f.send('error:offline'); await run;
    const state = f.controller.snapshot(), d = state.lastFailure;
    assert.equal(state.phase, 'unavailable'); assert.equal(state.credits, 0); assert.equal(state.adsRemaining, 2); assert.equal(state.busy, false);
    assert.equal(d.platform, platform); assert.equal(d.stage, 'ad_load'); assert.equal(d.code, 'no_fill'); assert.equal(d.sdk.code, 1); assert.equal(d.underlying.code, -1);
    assert.equal(d.action, 'show'); assert.equal(d.version, 1); assert.ok(d.elapsedMs >= 0); assert.ok(!isNaN(Date.parse(d.timestamp)));
    assert.equal(f.failures.length, 1); assert.equal(JSON.stringify(d).includes('secret'), false); assert.equal(Object.isFrozen(d.sdk), true);
    const retry = f.controller.watch(); f.send('earned'); f.send('closed'); await retry;
    assert.equal(f.controller.snapshot().credits, 1); assert.equal(f.controller.snapshot().lastFailure, d);
  });
}

test('direct gateway errors remain compatible with error.message and expose diagnostics', async () => {
  const f = fixture(); const run = f.gateway.show(() => {});
  f.send('error:offline:{"stage":"ad_load","code":"network","sdk":{"domain":"com.google.admob","code":2}}');
  await assert.rejects(run, e => e instanceof f.RewardError && e.message === 'offline' && e.failure.sdk.code === 2);
});

test('legacy and malformed bridge events safely degrade without exposing messages', async () => {
  for (const event of ['error:unavailable', 'error:offline', 'error:unavailable:{bad', 'unexpected', 'error:unavailable:null', 'error:unavailable:{"stage":"secret","code":"secret","sdk":{"domain":"secret@example.com","code":2}}']) {
    const f = fixture(); const run = f.controller.watch(); f.send(event); await run;
    const state = f.controller.snapshot();
    assert.equal(state.lastFailure.stage, 'unknown'); assert.equal(state.lastFailure.sdk, undefined);
    assert.equal(state.phase, event === 'error:offline' ? 'offline' : 'unavailable');
    assert.equal(JSON.stringify(state.lastFailure).includes('secret'), false);
  }
});

test('silent startup failures are observable without blocking play or changing ready phase', async () => {
  const f = fixture(); const run = f.controller.initialize();
  f.send('error:unavailable:{"stage":"consent_update","code":"sdk_error","sdk":{"domain":"UMPErrorDomain","code":3}}'); await run;
  assert.equal(f.controller.snapshot().phase, 'ready'); assert.equal(f.controller.snapshot().initializing, false);
  assert.equal(f.controller.snapshot().lastFailure.stage, 'consent_update'); assert.equal(f.failures[0].action, 'refreshPrivacy');
  assert.equal(f.controller.consume('first'), true);
});

test('privacy and ad timeout/presentation failures expose their stages without granting rewards', async () => {
  for (const [method, stage, code] of [['privacy','privacy_present','sdk_error'], ['watch','ad_load','timeout'], ['watch','ad_present','presentation_rejected']]) {
    const f = fixture(); const run = f.controller[method]();
    // privacy() first awaits an already-created initialization only when one exists.
    f.send(`error:unavailable:${JSON.stringify({stage,code})}`); await run;
    assert.equal(f.controller.snapshot().lastFailure.stage, stage); assert.equal(f.controller.snapshot().lastFailure.code, code);
    assert.equal(f.controller.snapshot().credits, 0); assert.equal(f.controller.snapshot().busy, false);
  }
});

test('preflight network, policy, presenter and disposal failures have stable codes', async () => {
  for (const [setup, code, platform] of [[f=>f.offline(),'network','ios'], [f=>f.rejectPolicy(),'policy_rejected','ios'], [f=>{ f.core.Application.android.foregroundActivity=null; },'no_presenter','android'], [f=>f.gateway.dispose(),'disposed','ios']]) {
    const f = fixture(platform); setup(f);
    await assert.rejects(f.gateway.show(() => {}), e => e.failure.code === code);
    assert.equal(f.failures.length, 1); assert.equal(f.calls(), 0);
  }
});

test('failure after earning keeps the credit and exposes the presentation diagnostic', async () => {
  const f = fixture(); const run = f.controller.watch();
  f.send('earned'); f.send('error:unavailable:{"stage":"ad_present","code":"sdk_error"}'); await run;
  assert.equal(f.controller.snapshot().credits, 1); assert.equal(f.controller.snapshot().phase, 'earned');
  assert.equal(f.controller.snapshot().lastFailure.stage, 'ad_present'); assert.equal(f.failures.length, 1);
});

test('public factory forwards the Release diagnostic hook independently of wallet storage', async () => {
  const storage = new Map(), failures = [];
  const { createRewards } = loadTS('bridge/rewards/native.ts', { '@nativescript/core': {
    isIOS: true, isAndroid: false,
    ApplicationSettings: { getString: k => storage.get(k), setString: (k,v) => storage.set(k,v), flush: () => true },
    Connectivity: { getConnectionType: () => 1, connectionType: { none: 0 } },
  }, '../platform/runtime': {getNativeCapabilities:()=>({rewardedAds:'available'})} }, { NSBundle: { mainBundle: { objectForInfoDictionaryKey: () => 'Release' } } });
  const c = createRewards({ storageNamespace: 'diagnostics-test', iosUnit: 'invalid', androidUnit: '', dailyFree: 1, dailyAds: 2,
    onFailure: d => { failures.push(d); storage.set('last-failure', JSON.stringify(d)); } }, { entitled: () => false, pause: () => () => {} });
  await c.watch();
  assert.equal(failures[0].code, 'invalid_unit'); assert.equal(c.snapshot().lastFailure.code, 'invalid_unit');
  assert.equal(JSON.parse(storage.get('diagnostics-test.reward-wallet')).credits, 0);
  assert.equal(JSON.parse(storage.get('last-failure')).stage, 'configuration');
});
