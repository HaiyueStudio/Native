import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './support/load-ts.mjs';
const core = { isIOS: true, isAndroid: false, Connectivity: { getConnectionType: () => 1, connectionType: { none: 0 } } };
function fixture(policy = { iosTrackingAuthorization: 'system' }) {
  let status = 'notDetermined', finish;
  const actions = [];
  class Ads {
    configurePolicy() { return true; }
    consentRequired = false;
    get trackingAuthorizationStatus() { return status; }
    performUnitEvents(action, unit, callback) {
      actions.push(action);
      if (action === 'presentConsent') finish = () => { status = 'denied'; callback('closed'); };
      else callback('closed');
    }
    dispose() {}
  }
  const { AdMobRewardGateway } = loadTS('bridge/rewards/admob.ts', { '@nativescript/core': core }, { HYRewardedAds: Ads });
  const gateway = new AdMobRewardGateway({ policy, iosUnit: 'ca-app-pub-2053256758816744/1234567890', androidUnit: '' });
  return { gateway, actions, finish: () => finish(), status: value => { status = value; } };
}
test('system ATT is included in unpaid startup even where UMP does not require a form', async () => {
  const f = fixture(); const startup = f.gateway.initialize(true, async () => true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.actions, ['refreshPrivacy', 'presentConsent']);
  const ad = f.gateway.show(() => {});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.actions.includes('show'), false);
  f.finish(); await startup; await ad;
  assert.equal(f.gateway.trackingAuthorizationStatus(), 'denied');
  assert.deepEqual(f.actions, ['refreshPrivacy', 'presentConsent', 'show']);
});
test('paid and legacy startup do not request ATT; live status follows Settings changes', async () => {
  const paid = fixture(); await paid.gateway.initialize(false, async () => true);
  assert.deepEqual(paid.actions, ['refreshPrivacy']);
  paid.status('authorized'); assert.equal(paid.gateway.trackingAuthorizationStatus(), 'authorized');
  paid.status('restricted'); assert.equal(paid.gateway.trackingAuthorizationStatus(), 'restricted');
  paid.gateway.dispose(); assert.equal(paid.gateway.trackingAuthorizationStatus(), 'unavailable');
  const legacy = fixture({}); await legacy.gateway.initialize(true, async () => true);
  assert.deepEqual(legacy.actions, ['refreshPrivacy']);
});
test('unresolved system authorization remains a sanitized error, not ad fill or reward success', () => {
  const { rewardErrorFromEvent } = loadTS('bridge/rewards/errors.ts');
  const error = rewardErrorFromEvent('error:unavailable:{"stage":"tracking_authorization","code":"tracking_unresolved"}', 'ios', 'show', Date.now());
  assert.equal(error.failure.stage, 'tracking_authorization');
  assert.equal(error.failure.code, 'tracking_unresolved');
});
test('regional consent followed by ATT acquires the startup pause only once', async () => {
  let callback, presentations = 0, pauses = 0;
  class Ads {
    configurePolicy() { return true; }
    consentRequired = true;
    performUnitEvents(action, unit, cb) {
      if (action === 'refreshPrivacy') { cb('closed'); return; }
      callback = cb; cb('presenting');
    }
    continuePresentation(ready) {
      assert.equal(ready, true); presentations++;
      callback('presentation-closed');
      callback(presentations === 1 ? 'presenting' : 'closed');
    }
  }
  const { AdMobRewardGateway } = loadTS('bridge/rewards/admob.ts', { '@nativescript/core': core }, { HYRewardedAds: Ads });
  const gateway = new AdMobRewardGateway({ policy: { iosTrackingAuthorization: 'system' }, iosUnit: '', androidUnit: '' });
  await gateway.initialize(true, async () => { pauses++; return pauses === 1; });
  assert.equal(presentations, 2); assert.equal(pauses, 1);
});
