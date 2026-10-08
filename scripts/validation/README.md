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
