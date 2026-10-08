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
