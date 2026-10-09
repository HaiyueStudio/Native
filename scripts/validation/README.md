# Native mobile acceptance host

This disposable host lives under ignored `artifacts/native-validation`, uses ID `org.haiyue.nativevalidation`, and never opens a game's storage. It includes the current staged package, AVFoundation/ZXing, and the real AdMob/UMP native sources with **Google test App IDs and test ad units only**.

1. Run `node npm/stage-development.mjs`.
2. Run `node scripts/validation/prepare-mobile.mjs /absolute/path/to/installed/nativescript-host/node_modules`. The development machine supplies the pinned NativeScript 9.1.1 CLI, 9.0.3 platform runtimes and dependencies; no sibling game source is copied. The host stages source and links the supplied dependency installation. It is not a production package.
3. Build iOS with NativeScript, Xcode 26.3 and an explicit developer team; build Android with JDK 21 / SDK 36. Supply local CocoaPods/SDK/cache settings. Do not replace a game's bundle ID with this test ID.
4. Install and open Native Validation. Check camera denial/retry, QR success, cancellation, immediate reopen, rotation/background, and the 8-character rejection action. Cancel+concurrency automatically cancels after four seconds and verifies rejection of a second simultaneous request.
5. Use a real QR printed/displayed on another device, including a logo QR and a non-application URL. Native must only return text. Application-specific validation is owned by the consuming app.
6. Watch a Google rewarded test ad and confirm one reward increases credits by 3; close before earning and confirm no credit. Test disposal while loading and retry after relaunch. Do not click ad destination links. Consent errors and unavailable network are failures to record, not successful ad playback.
7. Collect `Documents/native-validation.jsonl` (iOS appDataContainer via devicectl, Android `run-as` files). Logs capture test payloads; use synthetic data only. Restore the normal game to the foreground after tests.

Record actual devices, package hashes and each outcome under release evidence. Node mocks only validate lifecycle control flow; they cannot prove camera access, native metadata binding, or SDK presentation.

## System share acceptance

The host also includes Share text / Share image using synthetic content and example.com. Android preparation installs a dedicated cache-only FileProvider. Open and cancel each sheet, reopen immediately, rotate, and test background/return. On iPad confirm the popover is anchored. To verify a receiving app, manually choose an intended destination and inspect the image and text; do not treat presentation or chooser return as publication. No photos permission should appear. Android returns presented even after cancellation because chooser results cannot establish delivery.

For Web, run `node scripts/validation/prepare-share-web.mjs` and serve `artifacts/share-web` over localhost or HTTPS. Check capability reporting, text/image sharing on a supported browser, cancellation, and the explicit image-download fallback. Browser and mocked tests cannot prove Native UI acceptance.

## Engine share-content device acceptance

Build the current Engine and extensions workspaces, then opt into the separate content-generation screen:

```sh
mkdir -p artifacts/share-content-polyfills
cp scripts/validation/share-mobile/polyfills-package.json artifacts/share-content-polyfills/package.json
cp scripts/validation/share-mobile/polyfills-package-lock.json artifacts/share-content-polyfills/package-lock.json
npm ci --prefix artifacts/share-content-polyfills --ignore-scripts --no-audit --no-fund
node npm/stage-development.mjs
node scripts/validation/prepare-mobile.mjs /absolute/path/to/host/node_modules --share-content-engine /absolute/path/to/Engine
```

This copies built public package entries into the disposable host, without changing Native's released peer
dependency or any game's installation. The supplied NativeScript dependencies must include Canvas 2.1.18
with the existing audited GPUQueue/dynamic-offset binding patches, core-js-pure, and @webgpu/types.
The pinned Intl.getCanonicalLocales polyfill is host-only: iOS NativeScript 9.0.3 has no Intl global.
This demo uses text substitution; games using plural, date or number formatting must also provide those
Intl APIs. Card wrapping itself supports environments with no Intl.Segmenter or no Intl at all.
Native's frame runtime upgrades Core's legacy AbortController with `reason` and `throwIfAborted`;
modern implementations remain intact. A fixed GridLayout contains a 100%-size Canvas so Android's
CanvasFit policy cannot feed the resized drawing buffer back into embedded view measurements.

The screen renders a fixed Sudoku board using Engine GPU GUI. Its frame capture listener is registered
before the Native host's presentation listener; readback must occur while the current surface texture is
still acquired. Private Canvas2D surfaces use `willReadFrequently` and are reset after composition.
Native ImageSource decodes the encoded screenshot before the compositor borrows it.

On startup, four locale/layout combinations are generated and decoded; screenshot bright-pixel counts,
card dimensions, distinct output fingerprints and challenge round trips are checked. This is a synthetic
score and example.com URL, not a Sudoku generator or a deployed challenge page. Results and PNGs are
written to app Documents (iOS) / files (Android). Collect `share-content-validation.jsonl`,
`share-content-host.jsonl`, `share-source.png` and `result-*.png`.

Then open Share card / Share text, cancel, immediately reopen, rotate, and background/resume. The provided
`share-mobile/Acceptance.swift` drives those checks on iPhone; use `mobile/project.rb` with an explicit
`IOS_TEAM_ID` in an ignored artifacts directory. `share-mobile/ShareAcceptance.java` is an Android
instrumentation runner for the same disposable package. Neither test selects an external recipient.
System sheet presentation/cancellation does not prove delivery to another app or publication.

If XCTest cannot connect, explicitly launching with `SHARE_CONTENT_PRESENT=1` opens the iOS share sheet
after content verification, records whether UIActivityViewController is attached, and captures the app's
window. Remote system-share extension content may be absent from this UIKit screenshot; it does not
replace a system screenshot or prove cancellation. The probe leaves the sheet open for manual testing.
`node scripts/validation/share-mobile/collect-ios.mjs DEVICE OUTPUT_DIRECTORY --sheet` collects its files.

For Android instrumentation, copy `ShareAcceptance.java` into the prepared host's
`platforms/android/app/src/androidTest/java/org/haiyue/validation/`, set
`android { defaultConfig { testInstrumentationRunner "org.haiyue.validation.ShareAcceptance" } }`
in the host's App_Resources/Android/app.gradle, and build `:app:assembleDebugAndroidTest -x :app:buildMetadata`
after building the app. Reuse the app build's ANDROID_USER_HOME so both APKs have the same debug signing
key. Skipping metadata is test-APK-only, avoiding NativeScript's unrelated metadata-task dependency on
test class outputs. Install both APKs, then run
`adb shell am instrument -w org.haiyue.nativevalidation.test/org.haiyue.validation.ShareAcceptance`.

2026-10-08: iPhone XCTest completed with five cancelled share results (image twice, text twice,
then an image through landscape/background/foreground) and a fresh four-variant verification.
The test uses the real close button when available, otherwise the popover outside-dismiss region;
it does not invoke completion callbacks directly. See `bridge/share/evidence/device-content-2026-10-08.json`.

## ATT acceptance (iPhone)

Prepare the independent host with `--att` instead of `--share-content-engine`:

```sh
node npm/stage-development.mjs
node scripts/validation/prepare-mobile.mjs /absolute/path/to/host/node_modules --att
```

This screen uses the real `AdMobRewardGateway`, UMP and Google Mobile Ads with official test IDs.
It supplies `NSUserTrackingUsageDescription`, `GADDelayAppMeasurementInit=true`, and C++17 for the
Canvas dependency. Build with NativeScript's `build ios --for-device --team-id TEAM --no-hmr` and an
explicit `DEVELOPER_DIR`. No game storage is accessed. There is no synthetic TCF or ATT authorization.

Use `att-mobile/Acceptance.swift` with `mobile/project.rb` in a separate artifacts directory.
Its default tests reset only the test app's ATT permission, then test paid startup, legacy mode,
under-age policy and denial/relaunch. They require the global tracking-request setting already enabled;
if the OS returns denied/restricted instead of notDetermined, record that condition rather than
changing global privacy settings. They expect a real reachable UMP response; a network error is not
an authorization pass. Launch environment `HY_ATT_MODE` selects `system`, `legacy`, `underage` or `child`.
Policy is process-wide, so terminate and relaunch when changing modes.

Granting ATT and revoking it in Settings require the device owner's explicit authorization. Once
allowed, verify the actual system alert, authorized state, relaunch persistence, then revoke only
Native Validation's setting and use Read ATT status to verify denied after returning. Leave the test
app denied. Do not change other apps or the global tracking switch. Use Show Google test ad to check
loading after permission settles; never click ad destinations. Debug console stages `tracking request`,
`tracking settled`, `sdk initialize`, and `ad load` expose ordering without consent strings or IDFA.

Regional refusal must use a real configured UMP form and the SDK's registered test-device geography;
do not write TCF values to fabricate a device pass. Restricted OS status needs a suitable device/account
and must be reported separately from the host's under-age policy. Collect `Documents/att-validation.jsonl`,
XCTest results/screenshots and signed-build hashes. Node tests and native compilation are separate evidence.

When XCTest cannot attach, launch the app via `devicectl` with `HY_ATT_AUTOSTART=startup` or `paid`.
The probe waits for an active UIApplication, uses real SDK calls, and never answers a consent alert.
`HY_ATT_AUTOSTART=show` loads the official test ad only when the live ATT state is already `denied`;
otherwise it logs `probe-skipped`. Manually close the ad without clicking its destination, then collect
the log using `node scripts/validation/att-mobile/collect-ios.mjs DEVICE OUTPUT_DIRECTORY`.
Collect before each relaunch: the next process replaces the log. The host prevents auto-lock while open;
terminate it after acceptance. SDK debug console output may contain a test-device identifier; remove
that SDK line before archiving public evidence.

2026-10-09: owner refusal during the official test App ID's UMP form changed real ATT from
`notDetermined` to `denied` even under `legacy` policy, with no Native `tracking request` log.
This is consistent with an SDK-managed IDFA/ATT flow and is **not** a regional GDPR-refusal pass.
The legacy XCTest expectation needs a UMP configuration with no IDFA explainer; its default test App ID
does not establish that prerequisite. System, paid, under-age and child startup then completed with
the persisted denied state. These checks do not establish first-run suppression from `notDetermined`.
XCTest never started tests (runner exit 74); app-level SDK probes and the owner's actions supply the
device evidence. See `release/evidence/att-2026-10-09/summary.json` for passed and pending branches.
The denied-state Google test ad also completed its full lifecycle: one earned callback, owner dismissal,
one `presentation-closed`, then one successful `show` completion. Native `end event=closed` recorded
an active UIApplication and ATT `denied`; no operation error occurred. This verifies the denied-ad path,
not the remaining initial-authorization, regional-refusal or Settings-revocation branches.

The subsequent Settings branch also passed: manual enable produced real `authorized` on launch/resume;
the owner then confirmed disabling only Native Validation and the app read `denied` on launch/resume.
A further cold-start SDK flow completed with `denied`, without a presentation callback or native ATT
request. Settings changes resulted in new app launches, so this evidence does not assert an uninterrupted
same-process transition, nor does enabling in Settings prove the initial native ATT alert. Final ATT is
denied. See `ios-settings-*.jsonl` and the summary in the same evidence directory.

For first-request acceptance without overwriting an existing test app, prepare with
`HY_ATT_BUNDLE_ID=org.haiyue.nativevalidation.firstYYYYMMDDa` and `--att`. Bundle overrides are restricted
to this validation namespace. An optional `HY_ATT_ADMOB_APP_ID=ca-app-pub-…~…` selects an owner-configured
iOS UMP application; use one without an IDFA explainer when verifying Native's own ATT request branch.
These values affect only the disposable host. The rewarded ad unit remains Google's official test unit.
Build/sign/install as usual and pass the same bundle ID as the optional third argument to
`att-mobile/collect-ios.mjs`. The startup log includes the actual installed bundle and AdMob app IDs.
Collect a real `notDetermined` baseline, then verify native `tracking request` before the system alert,
`tracking settled` after the owner's response, and successful startup with the resulting OS state.
Do not mark this branch passed if UMP's IDFA flow consumed the permission before Native requested it.
See Google's [IDFA flow documentation](https://developers.google.com/admob/ios/privacy/idfa) and
[UMP message configuration](https://developers.google.com/admob/ios/privacy).

2026-10-09 first-request acceptance passed on the separate `org.haiyue.nativevalidation.first20261009a`
app using the owner's iOS AdMob App ID. Real UMP returned `notRequired` while ATT was `notDetermined`.
Paid startup completed without consuming the first request. Unpaid startup logged exactly one Native
`tracking request`; the owner confirmed the Apple system alert and chose not to track. Native then
logged one `tracking settled` with `denied`, and startup completed successfully. A cold relaunch completed
with `denied` and no new presentation or ATT request. No ad SDK initialization or ad load was initiated
in these startup cases. This covers the initial refusal branch; Settings enable/revoke is documented
separately. Full evidence and signed-build hashes: `release/evidence/att-2026-10-09/first-request/summary.json`.

The subsequent fresh `org.haiyue.nativevalidation.policy20261009b` app completed legacy, under-age and
child startup with ATT remaining `notDetermined`; no presentation or Native tracking request occurred.
For regional refusal, launch with `HY_UMP_EEA=1`, the SDK-reported `HY_UMP_TEST_DEVICE_ID`, and
`HY_UMP_RESET=1` on this disposable Debug host. The real UMP form became required; the owner rejected
the optional consents and saved. Startup completed with ATT still `notDetermined` and no Native ATT
request. Relaunching in the same test geography **without** reset preserved that result and presented
neither form nor ATT alert. The initial offline launch and a background-interrupted presentation are
retained as failed attempts, not counted as passes. See `release/evidence/att-2026-10-09/remaining/`.

OS `restricted` is still separate: neither an app's age policy nor a normal `denied` result proves it.
Obtain the owner's permission before attempting any device-wide Screen Time restriction; record the
original settings, read the real OS status, and restore the original settings after the test. Only an
actual `restricted` result plus successful startup qualifies. On 2026-10-09 the owner authorized and
manually applied a temporary Screen Time restriction. Explicit reads remained `notDetermined`; cold
startup displayed the normal Apple ATT alert and completed with `denied` after owner refusal. This
attempt did **not** reproduce `restricted`. The owner confirmed restoring Content & Privacy Restrictions
to its original main-switch-off state; the resumed app reported `denied`, and the test app was stopped.
Individual suboption values were not recorded; restoration relies on owner confirmation, not ATT status.
Real OS `restricted` acceptance remains pending on a suitable device/account. Evidence is preserved in
`release/evidence/att-2026-10-09/remaining/restricted-startup.jsonl` and the matching native log.

Automated `restricted` coverage was added on 2026-10-09 at the owner's request. Run it with:

```sh
node --test test/tracking-authorization.test.mjs test/tracking-restricted-native.test.mjs
```

The macOS Swift runner compiles the complete production `HYRewardedAds.swift` class, replacing only
its SDK imports with test doubles. It covers startup without prompting or preloading, repeat startup,
required regional forms, consent-blocked ads, explicitly requested ads and earned callbacks, and a
`notDetermined` request that settles to `restricted`. This last case is a positive control proving the
request boundary is exercised. The TypeScript tests cover unpaid startup completion, paid startup,
explicit ad requests and live status changes. The Swift test requires macOS and Xcode Command Line
Tools and is explicitly skipped elsewhere; the TypeScript tests remain portable. Both are included
in `npm test`. No runtime permission override or production policy change was introduced.

Full suite: **103 passed, 0 failed, 0 skipped**. This proves application behavior under simulated SDK
inputs, not Apple's ability to produce `restricted`, real SDK ad delivery, or physical-device UI.
Acceptance status remains **automated passed / 真机待验收**. Evidence and source hashes:
`release/evidence/att-2026-10-09/restricted-automated/summary.json`.
