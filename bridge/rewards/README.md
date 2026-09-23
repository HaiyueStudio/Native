# Reusable rewarded allowances

`RewardController` is independent of NativeScript, rendering, puzzle rules and AdMob.
`AdMobRewardGateway` implements the native SDK boundary (Swift + Java), including UMP consent.
Existing nonconsumable ownership stays in `bridge/purchases`; pass its current verified entitlement to `entitled()`.

## Integrating another game

1. Create one controller per feature/wallet, with a unique persistent storage key. Do not put the wallet in a level save or clear it on restart/shuffle.
2. Set `dailyFree`, `dailyAds`, `entitled`, synchronous atomic `storage.read/write`, and `pause: () => host.preparePresentation()`.
3. Subscribe to snapshots and request a frame on changes. After the first frame and entitlement refresh, call `initialize()` once per host session. iOS updates UMP at startup, presenting required consent only for free users; it never initializes or preloads ads here. Refresh on app resume. Dispose with the host. Android startup initialization remains deferred; its explicit ad/privacy flow still updates UMP.
4. Run the requested operation first. Once a useful result is ready, call `consume(stableResultKey)`. Show the result only if it returns true. Do not debit on timeout/cancellation/no solution.
5. A previously delivered result key is free to display again during the same allowance day. Include level/date and result identity in the key.
6. When access is exhausted, offer an explicit “watch an ad for 1 [reward]” action calling `watch()`, along with decline and paid-unlock actions. Never call `watch()` from a timer, level transition or failed solver.
7. Display a privacy-options button when `snapshot().privacyRequired` is true, calling `privacy()`.
8. Use a structural game-side interface so browser builds never import NativeScript/SDK code.

Calendar Puzzle is the reference integration (`examples/calendar-puzzle/src/main-page.ts`, `Games/games/calendar-puzzle/rewards.ts`). For NativeScript, include the shared Swift files through `ios.NativeSource`, GoogleMobileAds via `ios.SPMPackages`, and the shared Java source directory plus Google Mobile Ads/UMP dependencies in app.gradle. Each app must supply its own AdMob app IDs and ad units.

## Semantics

- Local calendar day; moving the clock backwards cannot refresh an already used day. This is a local convenience quota, not a server-backed anti-cheat or account-sync service. Reinstall, cleared storage and clock manipulation are not cryptographically prevented.
- Free allowances do not accumulate. Earned credits survive day changes and restarts; free allowance is used first.
- Ads are limited by **earned rewards** per day; no-fill, early close, consent failure and offline attempts do not use the cap.
- Only Google's earned callback adds a credit, synchronously persisted before dismissal. Duplicate/stale callbacks are ignored. Concurrent watch requests coalesce by rejecting additional attempts while busy.
- There is no mediation configuration. Google guarantees earned callbacks precede dismissal; a future mediation provider with different ordering must adapt its protocol before reuse.
- Corrupt storage/write failures fail closed with an error; do not pretend a failed save succeeded. Storage is local and not a substitute for high-value server-side verification.
- The loading/disabled UI is rendered once, then rendering, audio and input pause for consent/ad/privacy presentations. OS background/foreground changes cannot release the presentation's pause token. Each token is idempotent and supports nesting.
- iOS consent-info network updates have a 20-second deadline; ad loading has a 45-second native SDK deadline. Once an ad or consent form is on screen, no JS timer forces rendering to resume behind it.
- Paid users' `watch()` is a no-op, and consume is unlimited. Entitlement revocation is evaluated live; earned credits remain available.

## Test / production

Calendar Puzzle has production iOS IDs configured; Debug always substitutes Google's official demo ad unit. Android production setup is deferred. The adapter refuses demo IDs in Release builds; it does not silently show fake rewarded ads. Production requires replacing the native app IDs and TS ad unit IDs, configuring UMP messages, and completing each store's privacy disclosures. No Firebase dependency or ATT permission request is introduced; requests explicitly set `npa=1`. Non-personalized ads still require appropriate consent and privacy disclosures.

Run reference-app `npm test` for quota, persistence, failure, callback ordering, entitlement and lifecycle tests. `CALENDAR_REWARDS_SMOKE` is a development-only isolated save/wallet integration test. Add `CALENDAR_REWARD_AD_SMOKE` to request an official demo ad; do not interact with live ads during development.

For iOS UMP diagnostics, first read the test-device identifier from the SDK log. In Debug only, supply `HY_UMP_TEST_DEVICE_ID` and `HY_UMP_EEA=1` to simulate Europe; `HY_UMP_RESET=1` resets consent during initialization for a fresh-choice test. Do not use these flags for a normal launch. No device identifier is hardcoded. Release ignores these flags. These settings do not bypass the SDK, grant rewards or unlock paid access.

Simulators are automatically recognized as UMP test devices, so omit `HY_UMP_TEST_DEVICE_ID` there. Launch with `SIMCTL_CHILD_HY_UMP_EEA=1 SIMCTL_CHILD_HY_UMP_RESET=1 xcrun simctl launch --console <simulator> <bundle-id>`. Debug logs include the app ID, runtime SDK versions, simulator flag, parameter geography and under-age flag, consent/form/privacy status, elapsed time, presenting-controller attachment, and error domain/code/description (including underlying errors). They do not dump consent strings, test-device identifiers or arbitrary error payloads. A logged geography is the supplied parameter, not proof that the server accepted it; compare the resulting form state across simulator and device.
