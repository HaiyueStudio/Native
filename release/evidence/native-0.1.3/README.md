# Native 0.1.3 release acceptance — 2026-09-28

Version metadata and lockfiles are 0.1.3. Release commit `d7a677b071b2618cdb91d9ea8aaf42db846a692b` and tag `native-v0.1.3` have been pushed to origin. npm login succeeded, but the separate publish two-factor authorization expired before completion. npm publication is pending a fresh publish authorization. The formal tarball has passed type and platform-entry tests.

## Source and package gates

- Final freeze contains 757 inputs.
- [Source gate](source-gate.json): 27 stages passed, 171 tests (84 repository/service, 3 actual-tarball/package, 84 across six examples), all relevant TypeScript checks passed.
- [Independent clean export gate](clean-source-gate.json): locked dependencies installed in a fresh exported working directory and all checks passed. Its manifest hash matches the final working-tree gate and `release/candidate.json`.
- Candidate package is private. Formal package still requires the matching `native-v0.1.3` tag.
- Earlier pre-device-fix gates are superseded by these final reports; do not reuse their manifest hashes as final evidence.

## Native build and device results

Both iOS and Android isolated validation apps were built with the real Google Ads SDK and camera integration, installed on iPhone 15 Plus and X4000 respectively. Build hashes / bridge inputs are in [native-builds.json](native-builds.json). The app uses `org.haiyue.nativevalidation`, a separate reward wallet, and Google test ad units. Existing game bundles and saves were not modified.

| Check | iPhone | Android |
| --- | --- | --- |
| Real camera scans QR with center logo | Passed: expected 29-character text returned | Passed: same text returned |
| Text longer than configured 8-character limit | Rejected, scanner closed | Rejected, scanner closed |
| Repeated open after scan/error | Passed | Passed |
| Camera permission denied | Node lifecycle regression only | Physical device returns Camera permission denied; no QR imported |
| Concurrent scanner | Rejected | Rejected |
| Programmatic cancel after 4 seconds | Returns null, closes camera | Returns null, closes camera |
| Test rewarded ad | User completed playback; logs confirm 0 → 3 credits and 100 → 99 ad allowances | Passed after user enabled VPN: 0 → 3 credits, 100 → 99 allowances, busy released |
| Failed ad request | Unit regressions cover failure/disposal | Real UMP timeout after 20 seconds; no credits or allowance consumed; busy released |

Evidence: [iOS scan](ios-scan.jsonl), [iOS cancel and reward](ios-reward.jsonl), [Android scan and cancellation](android-scan.jsonl), [Android timeout](android-consent-timeout.jsonl), [Android permission denial](android-permission-denied.jsonl), [Android completed reward](android-reward.jsonl).

## Bugs fixed during acceptance

1. Android cancelled scan results could settle a newly opened scan using the same request code. Each invocation now uses a distinct request code; lifecycle regression covers the old result arriving after reopen.
2. iOS cancellation between camera permission completion and main-thread presentation could still open the camera. Pending cancellation is checked before creating the controller.
3. NativeScript 9.1.1 duplicated absolute Swift source paths from `monetizationBuild`. It now returns paths relative to the host directory; actual iOS SDK build and tarball regression pass.
4. Android Ads 25.5 requires SDK initialization before `putPublisherFirstPartyIdEnabled(false)`. Calling it from policy configuration caused first-use `policy_rejected`. It now executes after SDK initialization, before the ad request; consent gating and non-personalized request settings remain intact. Real device now completes policy setup, consent update, ad playback and reward settlement. SDK contract reference: [Google MobileAds API](https://developers.google.com/admob/android/reference/com/google/android/gms/ads/MobileAds).

## Explicit coverage limits

- iOS XCTest runner failed to establish its IDE connection (exit 74) twice, before test cases ran. It is **not** recorded as a pass. iOS camera/reward outcomes above come from user-operated physical tests and the app's captured logs.
- Automated iOS permission denial, rotation/background lifecycle and early ad close were not completed on-device. Permission rejection / cleanup / callback races are covered by Node platform mocks, not substituted for physical-device results.
- Android UMP initially timed out on the original network. After the user enabled VPN, the same installed build completed the test ad and granted exactly 3 credits. An additional tap during loading did not grant a second reward or consume another allowance. Both the timeout and success logs are retained; no consent bypass was used.
- No paid purchases, store receipts, real ad revenue, StoreKit sandbox or Play Billing acceptance are claimed. Monetization APIs remain experimental.
