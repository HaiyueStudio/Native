# API 36 verification — 2026-09-20

Final APK: `../../artifacts/android/calendar-puzzle-debug.apk` (debug signed).

- `apk-badging.txt`: compile/target 36, min 26.
- `build.log`, `typecheck.log`, `tests.log`: successful Android build, TypeScript and 16/16 unit tests.
- `signature.txt`, `zipalign.txt`: signature and 16 KB APK ZIP alignment passed.
- `native-alignment.json`: exact final APK SHA-256 and upstream native library alignment. LOAD alignment passes; RELRO ends need separate 16 KB compatibility work.
- `android14-smoke.jsonl`: final build, X4000 Android 14, 101/101 passed. Normal user save restored after diagnostics.
- `android16-smoke-partial.jsonl`: API 36 emulator, six scripted checks passed (worker hint, fixture, drag win, date history, assisted star behavior). The complete emulator smoke was not finished.
- `android16-settings.png`: actual touch opened settings on API 36. Language switching was also verified by the saved English UI on re-entry.
- `android16-before-lifecycle-fix.*`: rapid back/re-entry disposed the newly created host before it could render.
- `android16-final-reentry.*`: final fixed build renders the board and retained language after the same rapid back/re-entry sequence.
- `android16-normal.jsonl`: final build suspended at two presented frames with zero pending callbacks, then resumed with saved state. The emulator uses 4 KB pages and SwiftShader Vulkan, not a real API 36 phone or 16 KB device.
- `android16-system-events.txt`, `android16-exit-info.txt`: the slow emulator's ANRs concern phone/Google system services; collected records contain no game ANR or native crash. Two game exits in that capture were intentional force-stops during testing.

The emulator is used for functional compatibility only, not performance measurements. Full release-signing/AAB and 16 KB device certification are not complete.

See [upgrade notes and official references](../../docs/ANDROID-API36.md).
