# 2026-09-20 release preparation evidence

- `games-focused.log`: 38 calendar tests passed, including two new raster ownership/allocation tests.
- `native-tests.log`: 11 passed, including two new loading/diagnostic lifecycle tests.
- `games-build.log`: all 25 game builds completed (initial 60-second timeout retried with 180-second per-game timeout).
- `games-types.log`, `native-types.log`, `bridge-types.log`: TypeScript checks passed.
- `ios-build.log`, `android-build.log`: final native builds passed. The final moon deployment asset has SHA-256 `697577528fcc8585f9c452bb0579c077f8f0b8c3588e358864d5b21ead7b3f10`; both packages were checked against it.
- `ios-smoke.jsonl`, `ios-smoke-summary.json`: iPhone 15 Plus, 89 gameplay checks passed with scratch surfaces, cached hints and native splash dismissal; no error, continued past frame 4080. Final subsequent install refines the image and adds diagnostic-only counters/splash capture. This install succeeded, but its launch for screenshot capture was denied because the phone locked. No screenshot is claimed for the final logo layout.
- `games-full.log`, `games-full-summary.log`: full suite run and remaining unrelated failures/timeouts. The initial raster test parsing issue was fixed and rechecked in the 38-test focused suite.
- Android device was disconnected during this task; final APK was built, but no new Android device validation is claimed.

No store account, paid product or public release was created. No payment or paywall has been added. Real player save namespaces were not used for the diagnostic run.
