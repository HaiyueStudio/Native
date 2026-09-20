# Android API 36 upgrade

## Build configuration

- `App_Resources/Android/gradle.properties` pins `compileSdk=36`, `targetSdk=36`, `buildToolsVersion=36.0.0`. These are NativeScript user properties, applied when regenerating `platforms/android`.
- Minimum API remains 26. Package ID and debug signing identity are unchanged, allowing `adb install -r` to preserve game saves.
- Existing NativeScript Android 9.0.3 supplies AGP 8.12.1 and Gradle 8.14.3, which support API 36. No runtime major-version migration is required for compilation.
- The SDK preflight in `scripts/android.mjs` now checks the API 36 platform and tools.
- Manifest declares `android:appCategory="game"`. Android 16 exempts games from its new large-screen forced-orientation policy. The existing immersive edge-to-edge implementation is retained; no deprecated edge-to-edge opt-out is added.
- Core 9.1.1 registers AndroidX `OnBackPressedCallback` on API 33+; the app does not introduce legacy back-key interception.
- Back/re-entry testing exposed a lifecycle race: an old Page unload / Activity exit could dispose the new host. `main-page.ts` now checks the owning Page and Activity before teardown; a regression test covers late old-page events and background unload.

## Verified

- Native TypeScript check and 16 unit tests passed.
- Android debug build succeeded. APK metadata reports compile API 36, target API 36, minimum API 26.
- APK signature verification and `zipalign -c -P 16` passed.
- X4000, Android 14 / API 34: same APK installed as an update; all 101 native gameplay checks passed, including worker hints, double taps, animations, history, language, audio and demand rendering. Normal launch and the user's save were restored afterwards.
- Android 16 / API 36 x86_64 emulator (4 KB pages, SwiftShader Vulkan): WebGPU startup, native worker hint, legal fixture, drag-to-win, full-date history and assisted star checks passed (6 scripted checks). Real touch opened settings and switched language. The final build passed the formerly failing rapid system-back/re-entry sequence; the board and saved English preference rendered correctly instead of going black.
- Final build also passed Home/background resume: the log recorded suspension at two presented frames with zero queued callbacks; after resume, actual touch opened the English settings panel. See `android16-resumed-settings.png`. The emulator was shut down after verification.
- The full 101-check run was not completed on the emulator. Its first boot/software graphics were slow and system phone/Google services reported ANRs; captured event/exit records did not report a game ANR or native crash. This environment is not performance evidence or 16 KB validation.
- Evidence: `../evidence/20260920-api36/`.

## Separate release checks

API level and native memory-page compatibility are different requirements. The packaged arm64/x86_64 libraries have 16 KB-aligned ELF LOAD segments, but the RELRO segment ends in the existing NativeScript/Canvas binaries are not all aligned to 16 KB. See `native-alignment.json`. APK ZIP alignment alone does not certify runtime compatibility on 16 KB devices; update/rebuild upstream native libraries as needed and test a real 16 KB environment before release.

This remains a debug-signed test APK. Store release signing, production AAB verification, billing and store submission are separate work.

## Official references

- [Android 16 SDK setup](https://developer.android.com/about/versions/16/setup-sdk)
- [AGP 8.12 compatibility](https://developer.android.com/build/releases/agp-8-12-0-release-notes)
- [Android 16 target behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16)
- [16 KB page size and RELRO checks](https://developer.android.com/guide/practices/page-sizes)
