import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadTS } from './support/load-ts.mjs';
const require = createRequire(import.meta.url);
const { monetizationBuild } = require('../bridge/monetization/build.cjs');
const { validateStoreConfig } = loadTS('bridge/purchases/config.ts');
const { resolveAdMobPolicy } = loadTS('bridge/rewards/policy.ts');
const demo = { iosAppId: 'ca-app-pub-3940256099942544~1458002511', androidAppId: 'ca-app-pub-3940256099942544~3347511713' };
test('optional build wiring includes only selected SDKs and refuses release demo IDs', () => {
  const empty = monetizationBuild(); assert.equal(empty.ios.NativeSource.length, 0);
  const purchases = monetizationBuild({ purchases: true });
  assert.equal(path.isAbsolute(purchases.ios.NativeSource[0].path), false);
  assert.equal(path.resolve(purchases.ios.NativeSource[0].path), path.resolve('bridge/purchases/native/ios/*.swift'));
  assert.equal(purchases.ios.NativeSource.length, 1); assert.equal(purchases.ios.SPMPackages.length, 0);
  assert.match(purchases.androidGradle, /billing:8.3.0/); assert.doesNotMatch(purchases.androidGradle, /play-services-ads/);
  const full = monetizationBuild({ purchases: true, rewards: demo, development: true });
  assert.equal(full.ios.NativeSource.length, 2); assert.equal(full.ios.SPMPackages.length, 1);
  assert.equal(full.iosInfoPlist.GADApplicationIdentifier, demo.iosAppId);
  assert.equal(full.iosInfoPlist.GADDelayAppMeasurementInit, true);
  assert.equal(full.androidManifestMetadata['com.google.android.gms.ads.APPLICATION_ID'], demo.androidAppId);
  assert.match(full.androidGradle, /user-messaging-platform:4.0.0/);
  assert.throws(() => monetizationBuild({ rewards: demo }), /Demo/);
  assert.throws(() => monetizationBuild({ rewards: { ...demo, iosAppId: "bad'\n" }, development: true }), /Invalid/);
});
test('policy validates age treatment and rating; defaults do not enable personalization', () => {
  assert.equal(resolveAdMobPolicy().maxAdContentRating, 'G');
  assert.equal(resolveAdMobPolicy().ageTreatment, 'unspecified');
  assert.equal(resolveAdMobPolicy({ ageTreatment: 'teen', underAgeOfConsent: true }).underAgeOfConsent, true);
  assert.throws(() => resolveAdMobPolicy({ maxAdContentRating: 'unknown' }), /Invalid/);
  assert.throws(() => resolveAdMobPolicy({ underAgeOfConsent: 'yes' }), /Invalid/);
});
test('store configuration requires a namespace and complete HTTPS verification scope', () => {
  const config = { productId: 'full_unlock', storageNamespace: 'game-one' };
  validateStoreConfig(config);
  validateStoreConfig({ ...config, androidPackage: 'com.example.game', verificationUrl: 'https://example.invalid/verify', verificationPublicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----' });
  for (const bad of [{ ...config, storageNamespace: '' }, { ...config, verificationUrl: 'http://example.invalid' }, { ...config, verificationPublicKey: 'private key' }]) assert.throws(() => validateStoreConfig(bad));
});
test('iOS store uses injected product ID and settles disposal without leaking other product ownership', async () => {
  const products = [], callbacks = [];
  const Native = { alloc: () => ({ initWithProductIDOnChange(id) { products.push(id); return this; }, callCompletion(action, cb) { callbacks.push(cb); }, dispose() {} }) };
  const { NativeStore } = loadTS('bridge/purchases/store.ios.ts', {}, { HYNonConsumableStore: Native });
  const first = new NativeStore({ productId: 'first_unlock', storageNamespace: 'first' });
  const second = new NativeStore({ productId: 'second_unlock', storageNamespace: 'second' });
  const a = first.access(false), b = second.access(false);
  callbacks[0]('{"owned":true}'); callbacks[1]('{"owned":false}');
  assert.equal((await a).owned, true); assert.equal((await b).owned, false);
  assert.deepEqual(products, ['first_unlock', 'second_unlock']);
  const pending = first.access(true); first.dispose(); await assert.rejects(pending, /unavailable/); second.dispose();
});
test('AdMob applies policy before native work and refuses failed configuration without requesting ads', async () => {
  let configured = 0, requests = 0, accept = true;
  class Ads {
    configurePolicy(json) { configured++; assert.equal(JSON.parse(json).maxAdContentRating, 'G'); return accept; }
    performUnitEvents(action, unit, cb) { assert.ok(configured); requests++; cb('closed'); }
    privacyRequired = true; consentRequired = false; dispose() {}
  }
  const core = { isIOS: true, isAndroid: false, Connectivity: { getConnectionType: () => 1, connectionType: { none: 0 } } };
  const { AdMobRewardGateway } = loadTS('bridge/rewards/admob.ts', { '@nativescript/core': core }, { HYRewardedAds: Ads });
  const g = new AdMobRewardGateway({ iosUnit: 'unused', androidUnit: '', development: true });
  await g.initialize(false, async () => true); assert.equal(requests, 1); g.dispose();
  accept = false;
  const bad = new AdMobRewardGateway({ iosUnit: '', androidUnit: '', development: true });
  await assert.rejects(bad.initialize(false, async () => true), /unavailable/); assert.equal(requests, 1);
});

test('native build flags control demo ads; JS development cannot bypass the release demo guard', async () => {
  for (const debug of [false, true]) {
    const units = [];
    class Ads { configurePolicy() { return true; } performUnitEvents(action, unit, cb) { units.push(unit); cb('closed'); } dispose() {} }
    const core = { isIOS: true, isAndroid: false, Connectivity: { getConnectionType: () => 1, connectionType: { none: 0 } } };
    const { AdMobRewardGateway } = loadTS('bridge/rewards/admob.ts', { '@nativescript/core': core }, {
      HYRewardedAds: Ads, NSBundle: { mainBundle: { objectForInfoDictionaryKey: () => debug ? 'Debug' : 'Release' } },
    });
    const gateway = new AdMobRewardGateway({ iosUnit: 'ca-app-pub-3940256099942544/1712485313', androidUnit: '', development: true });
    if (debug) { await gateway.show(() => {}); assert.equal(units.length, 1); }
    else { await assert.rejects(gateway.show(() => {}), /unavailable/); assert.equal(units.length, 0); }
  }
});
test('Android stores isolate installation and verified-cache namespaces between apps/products', async () => {
  const storage = new Map(), verified = [], requests = [];
  class Billing {
    constructor(context, id) { this.id = id; }
    static Listener = class { constructor(v) { Object.assign(this, v); } };
    static Completion = class { constructor(v) { Object.assign(this, v); } };
    call(action, activity, cb) {
      cb.complete(JSON.stringify(action === 'product' ? { price: '$2.00' } : { purchases: [{ token: 'token-' + this.id, purchased: true, pending: false }] }));
    }
    static tokenHash(token) { return 'hash:' + token; }
    static verifyLease(signed, key, product, pkg, installation) {
      verified.push({ product, pkg, installation });
      return JSON.stringify({ owned: true, tokenHash: 'hash:token-' + product, issuedAt: 1, expiresAt: Date.now() / 1000 + 1000 });
    }
    dispose() {}
  }
  let sequence = 0;
  const core = { Application: { android: { context: {}, foregroundActivity: {} } },
    ApplicationSettings: { getString: k => storage.get(k), setString: (k, v) => storage.set(k, v) },
    Http: { request: async value => { requests.push(JSON.parse(value.content)); return { statusCode: 200, content: { toJSON: () => ({ lease: 'signed' }) } }; } },
  };
  const { NativeStore } = loadTS('bridge/purchases/store.android.ts', { '@nativescript/core': core }, {
    org: { haiyue: { purchases: { HYPlayBilling: Billing } } }, java: { util: { UUID: { randomUUID: () => `installation-${++sequence}` } } },
  });
  for (const name of ['one', 'two']) {
    const store = new NativeStore({ productId: name + '_unlock', storageNamespace: name, androidPackage: 'com.example.' + name,
      verificationUrl: 'https://example.invalid/verify', verificationPublicKey: '-----BEGIN PUBLIC KEY-----\ntest' });
    assert.equal((await store.access(false)).owned, true); store.dispose();
  }
  assert.ok(storage.has('one.one_unlock.google.verified.v1')); assert.ok(storage.has('two.two_unlock.google.verified.v1'));
  assert.notEqual(verified[0].installation, verified[1].installation);
  assert.deepEqual(requests.map(r => r.productId), ['one_unlock', 'two_unlock']);
  assert.deepEqual(verified.map(v => v.pkg), ['com.example.one', 'com.example.two']);
});
