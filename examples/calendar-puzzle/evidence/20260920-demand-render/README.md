# Demand rendering verification (2026-09-20)

## Android device

- X4000 / Android 14: **101 / 101** native gameplay checks passed.
- Selected piece/hint idle, settings closed, rotation complete, async hint complete and layout complete: each sample waits 1,500 ms, then observes 800 ms. All samples show **zero additional presented frames and zero pending Native frame callbacks**.
- Holding a stationary finger also stops rendering. Moving it, rotating, changing language, receiving a worker reply and changing layout wake rendering successfully.
- Normal-save launch followed by actual background/foreground and a settings tap also passed. See `android-normal-resume.jsonl` and `android-resumed-settings.png`.
- During approximately 29.67 seconds idle, all app threads used 0.52 CPU seconds (1.75% of one core). This is a diagnostic observation, not a controlled energy, temperature or before/after measurement. Raw counts: `android-idle-cpu.json`.
- Restored normal launch without diagnostic flags. Updated `artifacts/android/calendar-puzzle-debug.apk`.

## iPhone

- Device build and installation succeeded. The app was suspended by the system twice during checks; both suspensions cancelled all pending frame callbacks.
- Partial passed checks do not constitute a full iOS regression pass. Requested that the phone remain unlocked, awake and in the game to continue. Current partial log: `ios-smoke.jsonl`.

## Automated checks

- Native tests: **15 / 15** passed. Calendar-specific Games tests: **38 / 38** passed.
- Games, Native app and shared Native bridge type checks passed.
- Calendar target, full Games build, Android debug and iOS device builds passed.
- Games full suite: 644 passed, 2 failed, 6 cancelled (timeouts), 20 skipped. Failures concern unchanged MUGEN serialization / viewer style contracts; timeouts concern Petra import and AI tests. See `games-tests.log`.

Rendering resolution, MSAA and active animation cadence remain unchanged. Idle keeps the last frame visible. No claim of a specific battery or temperature reduction is made.
