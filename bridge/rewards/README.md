# Reusable rewarded allowances

`RewardController` is independent of NativeScript, rendering, puzzle rules and AdMob.
`AdMobRewardGateway` implements the native SDK boundary (Swift + Java), including UMP consent.
Use `@haiyue/native/purchases/native` for non-consumable ownership; the consuming app decides how that verified entitlement maps to `entitled()`.

For the configurable factory, advertising policy and build helper see [monetization integration](../monetization/README.md).

## Integrating another game

1. Create one controller per feature/wallet, with a unique persistent storage key. Do not put the wallet in a level save or clear it on restart/shuffle.
2. Set `dailyFree`, `dailyAds`, optional `rewardAmount` (positive safe integer, default 1), `entitled`, synchronous atomic `storage.read/write`, and `pause: () => host.preparePresentation()`.
3. Subscribe to snapshots and request a frame on changes. After the first frame and entitlement refresh, call `initialize()` once per host session. iOS updates UMP at startup without setting reward busy or pausing input/rendering. Only if consent is required for a free user does the gateway await the controller's `beforePresent` callback to acquire the presentation pause, then present without repeating the consent-info request. It never initializes or preloads ads here. Refresh on app resume. Dispose with the host. Android startup initialization remains deferred; its explicit ad/privacy flow still updates UMP.
4. Run the requested operation first. Once a useful result is ready, call `consume(stableResultKey)`. Show the result only if it returns true. Do not debit on timeout/cancellation/no solution.
5. A previously delivered result key is free to display again during the same allowance day. Include level/date and result identity in the key.
6. When access is exhausted, offer an explicit “watch an ad for {snapshot().rewardAmount} [rewards]” action calling `watch()`, along with decline and paid-unlock actions. Never call `watch()` from a timer, level transition or failed solver.
7. Display a privacy-options button when `snapshot().privacyRequired` is true, calling `privacy()`.
8. Use a structural game-side interface so browser builds never import NativeScript/SDK code.

For NativeScript, include the shared Swift files through `ios.NativeSource`, GoogleMobileAds via `ios.SPMPackages`, and the shared Java source directory plus Google Mobile Ads/UMP dependencies in app.gradle. Each app must supply its own AdMob app IDs and ad units.

## Semantics

- Local calendar day; moving the clock backwards cannot refresh an already used day. This is a local convenience quota, not a server-backed anti-cheat or account-sync service. Reinstall, cleared storage and clock manipulation are not cryptographically prevented.
- Free allowances do not accumulate. Earned credits survive day changes and restarts; free allowance is used first.
- Ads are limited by **earned rewards** per day; no-fill, early close, consent failure and offline attempts do not use the cap.
- Only Google's earned callback adds the configured `rewardAmount` credits, synchronously persisted before dismissal. Duplicate/stale callbacks are ignored. Concurrent watch requests coalesce by rejecting additional attempts while busy.
- There is no mediation configuration. Google guarantees earned callbacks precede dismissal; a future mediation provider with different ordering must adapt its protocol before reuse.
- Corrupt storage/write failures fail closed with an error; do not pretend a failed save succeeded. Storage is local and not a substitute for high-value server-side verification.
- Network requests keep rendering active so disabled buttons can animate their loading indicators. Native consent/ad surfaces emit `presenting` only when ready; the adapter awaits the controller's presentation pause and acknowledges it with `continuePresentation`. `presentation-closed` releases the pause between consent and ad loading. OS background/foreground changes cannot release a visible presentation's token. Each token is idempotent and supports nesting.
- A slow startup privacy refresh leaves calendar navigation, free hints, and purchase-panel Today/Back actions responsive, including after background/resume. Explicit ad/privacy requests wait for that native refresh to settle and then retry independently; a pending explicit request supersedes automatic startup presentation. Startup completion must not release another operation's pause or clear its busy state.
- Consent-info/form loading has a 20-second native deadline; ad loading has a 45-second native SDK deadline. Once an ad or consent form is on screen, no JS timer forces rendering to resume behind it.
- Reward snapshots expose `initializing`, `operation`, and `presenting` independently of `busy`: startup can disable only its network-dependent controls, and the UI stops loading animation when a native surface is visible. Wallet operations and local navigation are not locked by startup queries. Consumers can add a leading-edge debounce in their UI, in addition to controller in-flight guards; never delay or replay checkout/ad actions.
- Paid users' `watch()` is a no-op, and consume is unlimited. Entitlement revocation is evaluated live; earned credits remain available.

## Test / production

Calendar Puzzle has production iOS IDs configured; Debug always substitutes Google's official demo ad unit. Android production setup is deferred. The adapter refuses demo IDs in Release builds; it does not silently show fake rewarded ads. Production requires replacing the native app IDs and TS ad unit IDs, configuring UMP messages, and completing each store's privacy disclosures. No Firebase dependency is introduced; requests explicitly set `npa=1`. iOS apps can opt into the native ATT flow with `policy.iosTrackingAuthorization: "system"` and a localized `NSUserTrackingUsageDescription`. Do not enable an AdMob IDFA explainer in parallel with this flow. Non-personalized ads still require appropriate consent and privacy disclosures.

Run Native `npm test` for quota, persistence, failure, callback ordering, entitlement and lifecycle tests. `CALENDAR_REWARDS_SMOKE` is a development-only isolated save/wallet integration test. Add `CALENDAR_REWARD_AD_SMOKE` to request an official demo ad; do not interact with live ads during development.

For iOS UMP diagnostics, first read the test-device identifier from the SDK log. In Debug only, supply `HY_UMP_TEST_DEVICE_ID` and `HY_UMP_EEA=1` to simulate Europe; `HY_UMP_RESET=1` resets consent during initialization for a fresh-choice test. Do not use these flags for a normal launch. No device identifier is hardcoded. Release ignores these flags. These settings do not bypass the SDK, grant rewards or unlock paid access.

Simulators are automatically recognized as UMP test devices, so omit `HY_UMP_TEST_DEVICE_ID` there. Launch with `SIMCTL_CHILD_HY_UMP_EEA=1 SIMCTL_CHILD_HY_UMP_RESET=1 xcrun simctl launch --console <simulator> <bundle-id>`. Debug logs include the app ID, runtime SDK versions, simulator flag, parameter geography and under-age flag, consent/form/privacy status, elapsed time, presenting-controller attachment, and error domain/code/description (including underlying errors). They do not dump consent strings, test-device identifiers or arbitrary error payloads. A logged geography is the supplied parameter, not proof that the server accepted it; compare the resulting form state across simulator and device.

## Failure diagnostics (Debug and Release)

`createRewards({ ..., onFailure })` and `new AdMobRewardGateway({ ..., onFailure })`
accept a synchronous, optional diagnostic callback. Each failed gateway operation
reports once, including startup consent failures. Callback exceptions are ignored
so diagnostic storage cannot prevent settlement or change rewards. No automatic
upload or disk storage occurs. The host owns any storage, retention and export UI.

`RewardController.snapshot().lastFailure` exposes the latest structured failure in
this session, retained after a successful retry and cleared by creating a new
controller. Startup failures still leave `phase: 'ready'` and local play available.
Failures after an earned callback retain the earned credits. Direct gateway callers
receive `RewardError` (exported from `@haiyue/native/rewards`); `error.message`
remains the existing `offline` / `unavailable` / `error` category.

```ts
import { ApplicationSettings } from '@nativescript/core';
import { createRewards } from '@haiyue/native/rewards/native';
import type { RewardFailure } from '@haiyue/native/rewards';

const diagnosticsKey = 'my-game.reward-last-failure';
const rewards = createRewards({
  storageNamespace: 'my-game', dailyFree: 1, dailyAds: 2,
  iosUnit: config.iosRewardUnit, androidUnit: config.androidRewardUnit,
  onFailure(failure: RewardFailure) {
    // Optional bounded local storage: overwrite one record, never the wallet.
    ApplicationSettings.setString(diagnosticsKey, JSON.stringify(failure));
    ApplicationSettings.flush();
  },
}, { entitled: () => purchases.snapshot().entitled, pause: () => host.preparePresentation() });
```

The version-1 record contains `platform`, gateway `action`, `stage`, stable `code`,
legacy `phase`, wall-clock ISO `timestamp`, and `elapsedMs` measured over the gateway
operation (including its internal phases, excluding the wait for a prior startup
operation). Optional `sdk` and `underlying` contain only `{ domain, code }`. Android
UMP has no domain accessor; its provider namespace is `com.google.android.ump`.
No messages, stack traces, ad unit/app/device IDs, account details, consent strings,
response IDs or raw SDK payloads are included. Unknown/malformed or older bridge
responses degrade to `unknown`; unknown numeric SDK codes are preserved.

Stages: `configuration`, `consent_update`, `consent_load`, `consent_present`,
`privacy_present`, `sdk_initialize`, `ad_load`, `ad_present`, `lifecycle`, `unknown`.
Typical codes: `no_fill`, `network`, `timeout`, `sdk_error`, `consent_unavailable`,
`invalid_unit`, `policy_rejected`, `no_presenter`, `presentation_rejected`, `busy`,
`inactive`, `disposed`, `invalid_action`, `bridge_error`, `unknown`.
A recoverable consent-update error followed by successful fallback is not a failed
operation and does not invoke `onFailure`. Cancellation without earning a reward
is also not an SDK failure.

For `ad_load`, normalize no-fill/network only when the SDK domain matches Google:
iOS no-fill is 1, network is 2, timeout is 5; Android uses the SDK constants (no-fill
3, network 2). Codes in other domains or presentation phases remain `sdk_error`;
do not interpret a bare numeric code across SDKs. Native deadlines report `timeout`
with the current stage and no fabricated SDK code. SDK initialization and ad load
share the existing 45-second deadline. Consent update and form load each have a
20-second deadline; no deadline runs while a form/ad is presented.

`no_fill` alone does not prove an account or app-readiness restriction. Diagnose the
SDK domain/code alongside the AdMob console and connectivity. References:
[iOS error codes](https://developers.google.com/admob/ios/api/reference/Enums/GADErrorCode),
[Android load errors](https://developers.google.com/admob/android/ad-load-errors).
Upgrade the TS adapter and both native bridges together and rebuild the app;
installing an npm dependency alone cannot update an existing TestFlight binary.

## iOS App Tracking Transparency

`iosTrackingAuthorization: "system"` refreshes regional consent first, presents required UMP consent, then uses Apple's system ATT alert. There is no custom tracking explainer. Paid startup (`presentForm=false`) does not request ATT. UMP `canRequestAds` is never treated as ATT authorization. SDK initialization and ad loading wait for the system request to settle; denied/restricted status does not block game or purchase operations. Google serves without IDFA when ATT is denied; publisher first-party ID and personalization remain disabled, with no custom user identifier. Hosts must audit any additional mediation/analytics SDKs separately.

In a GDPR region, the adapter conservatively requests ATT only after TCF consent for device access (purpose 1) and Google vendor 755, plus a permitted advertising-measurement basis (purpose 7 consent, or both purpose/vendor legitimate interest without objection). Missing, malformed, refused, or partial consent does not trigger ATT. Under-age/child/teen configurations do not request ATT. UMP/GMA still determine eligible ad-serving modes. No consent bits are written or logged. Outside a required regional-consent flow, ATT can appear during unpaid startup.

`gateway.trackingAuthorizationStatus()` reads the current OS state (including Settings changes). Do not cache it as an entitlement, reward authorization, or GDPR consent. `tracking_authorization / tracking_unresolved` means the system request did not settle; that operation fails before initializing/loading ads. Existing `iosTrackingAuthorization: "none"` preserves legacy behavior; it is not a declaration that the host or its SDKs do not track.

Release checklist: supply localized usage text matching actual advertising purposes; disable substitute IDFA prompts; disclose actual SDK data use in the store and policy; verify allow, deny, restricted, regional refusal, relaunch and Settings revocation on physical devices. Keep rewarded ads optional and never reward ATT consent itself.
