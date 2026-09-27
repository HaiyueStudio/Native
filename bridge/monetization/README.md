# Reusable purchases and rewarded ads

These are experimental capabilities in the Native 0.1.1 candidate. Published `@haiyue/native@0.1.0` has only the original rewards entry points. CalendarPuzzle and its submitted build are unchanged. Validate this implementation with the next consuming game before enabling monetization in that game.

## Boundary

Native owns StoreKit 2 / Play Billing adapters, verified entitlement state, single-flight operations, localized prices, consent/ad presentation and persisted reward allowances. The app owns the UI, copy, unlock rules, reward meaning and configuration. No game source, production product IDs, ad IDs, signing keys or user data is bundled.

Supported: **one non-consumable buy option per purchase controller and AdMob rewarded ads**. No subscriptions, consumable purchases, banners, interstitials, cross-platform account linking or mediation. Multiple product controllers can have distinct product IDs and storage keys; present only one store checkout at a time. Use one active rewarded gateway/controller per app host. The native advertising policy is process-wide; conflicting policies fail instead of silently replacing one another.

## Runtime integration

```ts
import { createPurchases } from '@haiyue/native/purchases/native';
import { createRewards } from '@haiyue/native/rewards/native';

const purchases = createPurchases({
  productId: 'full_unlock', // configure in App Store Connect / Play Console
  storageNamespace: 'my-game',
  androidPackage: 'com.example.game',
  // Android: supply HTTPS service URL and PUBLIC verification key after deployment.
  // verificationUrl: config.verificationUrl,
  // verificationPublicKey: config.verificationPublicKey,
});
const rewards = createRewards({
  storageNamespace: 'my-game.hints',
  dailyFree: 1,
  dailyAds: 2,
  iosUnit: config.iosRewardedUnit,
  androidUnit: config.androidRewardedUnit,
  policy: { maxAdContentRating: 'G', ageTreatment: 'unspecified', underAgeOfConsent: false },
}, {
  // Business mapping belongs to this app. Purchased does not inherently mean unlimited.
  entitled: () => purchases.snapshot().entitled,
  pause: () => host.preparePresentation(),
});
const removePurchase = purchases.subscribe(() => { rewards.refresh(); render(); });
const removeReward = rewards.subscribe(render);

// After the first game frame, then after querying ownership:
await purchases.refresh();
await rewards.initialize();
// UI taps: purchases.purchase(), purchases.restore(), rewards.watch(), rewards.privacy().
// Refresh on foreground and connectivity recovery:
// await purchases.refresh(); rewards.refresh();
// Consume only when the business operation has produced a useful result:
// if (rewards.consume(stableResultKey)) displayResult();
// Host destruction:
// removePurchase(); removeReward(); rewards.dispose(); purchases.dispose();
```

`PurchaseController` and `RewardController` are also available without any native imports from `@haiyue/native/purchases` and `@haiyue/native/rewards`, for custom storage/gateways and headless tests. Supply app-owned rendering/presentation hooks rather than importing game code into Native. The factory's reward namespace is exclusive to one active controller; concurrent controllers sharing a namespace are unsupported. Reward credits are local to the installation, not a server-backed currency.

### UI state contract

- Purchase snapshot starts at `phase: loading`, with no price. Buy disabled when `busy`, owned, pending, no price or `!canPurchase`; restore disabled while loading/busy. `price` comes from the store, never from a configured display string.
- Rewards expose `initializing`, `busy`, `operation`, `presenting`, `privacyRequired`. Disable ad-dependent actions during initialization and show loading. Continue rendering loading animations while networking; pause rendering/input only during native presentation. Local navigation need not wait for consent-info refresh.
- Purchase operations coalesce while in flight; reward operations reject additional attempts while busy. UI may additionally use a leading-edge debounce. Do not queue deferred purchase/ad clicks.
- Show a persistent privacy-options entry whenever required by the gateway. Consent refusal and network failures must not disable normal app usage.
- Free allowance expires at the local day boundary. Earned ad credits persist across days and restarts; spend free allowance first. Version-1 wallets migrate to version 2 without resetting balance, quotas or deduplication keys.
- iOS startup refreshes UMP; Android currently updates UMP on explicit ad/privacy actions. Neither platform preloads ads during startup. SDK privacy policy disables publisher first-party ID and publisher personalization and requests `npa=1`. Age treatment and UMP under-age settings must match the consuming app's audience; these settings are not a substitute for its privacy disclosures.

## Native build wiring

`@haiyue/native/monetization/build` is a CommonJS build helper, with no runtime SDK imports. Enable only the features used by the app:

```ts
// nativescript.config.ts; app-owned config holds the two AdMob APP IDs (~ separator).
const { monetizationBuild } = require('@haiyue/native/monetization/build');
const { writeFileSync } = require('node:fs');
const build = monetizationBuild({
  purchases: true,
  rewards: { iosAppId: config.iosAdMobAppId, androidAppId: config.androidAdMobAppId },
  development: config.debugBuild,
});
writeFileSync('App_Resources/Android/haiyue-monetization.gradle', build.androidGradle);
// Merge build.ios.NativeSource and build.ios.SPMPackages into existing ios config arrays.
// Do not replace the app's other native sources or packages.
export default { /* app config */, ios: build.ios };
```

In the app's `App_Resources/Android/app.gradle`, apply the generated fragment:

```groovy
apply from: new File(rootProject.projectDir, '../../App_Resources/Android/haiyue-monetization.gradle')
```

Merge `build.iosInfoPlist` into `App_Resources/iOS/Info.plist` and `build.androidManifestMetadata` as `<meta-data>` inside the Android manifest's `<application>`. Keep these templates app-owned; the helper never overwrites them. AdMob **app IDs** use `~`, rewarded **unit IDs** use `/`. Missing/malformed app IDs and demo app IDs in release configuration fail at build configuration time. The runtime derives Debug from native build flags and always substitutes demo ad units there; a JS flag cannot enable demo mode in Release. Debug demo app IDs are only for development; complete production console setup per app.

Pins: Google Mobile Ads iOS 13.10.0, Android 25.5.0, Android UMP 4.0.0, Billing 8.3.0. Purchases-only builds do not include ad sources or SDK dependencies. Keep the app's existing deployment targets, signing, manifest permissions, privacy manifests and any required SDK attribution resources. Billing configuration supports permanent buy options only, quantity one, no rent/preorder/consumption. iOS supports StoreKit 2 (iOS 15+).

Android additionally needs `services/play-entitlements`: configure and deploy it once per app/product scope. Without verifier configuration, Android can query a price but cannot buy or unlock. The service is a separate server template, **not part of the mobile npm package**.

## Validation and development package

From Native: `npm ci && npm test`. From Native/npm: `npm ci && npm run stage:development`, then `NATIVE_PACKAGE_ROOT=../artifacts/native-development-package npm test` (resolve the path from the npm directory). The stage command produces a private `<source-version>-development.0` package in `Native/artifacts/native-development-package`; its version is a development label, not a published release. Run `npm pack` in that directory for a local tarball.

The production pack command still requires the frozen release/tag to match. Do not refreeze the already published 0.1.0 candidate to accommodate new code. Before shipping a consuming app, validate the next game on both native platforms, including restore/cancel/pending/refund, offline/expired rights, UMP refusal/reopen, rewarded callback/dismissal and native UI lifecycle. Unit tests and native compilation are not store/Sandbox acceptance evidence.

## Reward amounts and upgrade catalogs

`createRewards({ ..., dailyFree: 5, dailyAds: 5, rewardAmount: 3 }, hooks)` grants
three credits per **earned ad**, consuming one ad allowance. `rewardAmount` is a
positive safe integer (default 1); `snapshot().rewardAmount` is the amount to show
in the app's reward disclosure. Existing wallets keep their actual balances.
Duplicate callbacks, cancellation and overflow never create extra credits.

`PurchaseCatalog` from `@haiyue/native/purchases` combines verified controllers:

```ts
const catalog = new PurchaseCatalog([
  { id: 'basic', store: basicStore, grants: ['basic'] },
  { id: 'advanced', store: advancedStore, grants: ['advanced'] },
  { id: 'full', store: fullStore, grants: ['basic', 'advanced'] },
  // Optional separately priced upgrade SKU, for games offering a base-owner price:
  { id: 'upgrade', store: upgradeStore, requires: ['basic'], grants: ['advanced'] },
], [{ id: 'full', requires: ['basic', 'advanced'] }]);
await catalog.refresh();
// Snapshot provides store-localized prices, eligibility and canPurchase.
await catalog.purchase('upgrade');
await catalog.restore();
const unlimitedHints = catalog.snapshot().entitlements.includes('full');
```

Configure each permanent product and price independently in App Store Connect /
Play Console: for example basic $1.99, advanced $4.99, full $5.99. The direct full
purchase is slightly cheaper; buying the separate packs still grants the complete
entitlement. The optional upgrade's price is also store-configured, not a dynamic
charge or a parsing/subtraction of localized prices. Do not display fabricated
price differences. Route every checkout through the catalog so native store UI
is single-flight. Controllers remain host-owned and should be disposed separately.

Upgrade prerequisites are rechecked before checkout and when deriving entitlements.
An upgrade receipt alone does not unlock dependent content after base revocation;
restoring both verified receipts restores access regardless of their read order.
This is not a store-level automatic bundle-discount API. Configure the Android
verifier for **each** product scope/endpoint. There is no iOS/Android account linkage.
