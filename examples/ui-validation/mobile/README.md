# G06 native controls consumer

Standalone app `org.haiyue.uivalidation` / **Haiyue UI**. It does not replace ShaderLab or existing validation apps, use advertising, or load Engine. The preview and code-editor panels demonstrate PlatformView ownership with native Label placeholders; production GPU/editor functionality is G07.

From the Native repository:

```sh
node examples/ui-validation/mobile/prepare.mjs \
  --ui /absolute/path/haiyue-ui-0.2.0.tgz \
  --sha256 5408bc4048919435e624a2a760a4d80194ec386173cb0e3e3ca3a76ccae8a794 \
  --modules /absolute/path/to/nativescript-toolchain/node_modules
npm run verify:ui -- --profile core
npm run verify:ui -- --profile consumer
```

Prepare checks the input tarball, assigns the private preview identity, packs Native and installs the two tarballs in `artifacts/ui-validation/mobile`. Its NativeScript build tools can be reused from an existing installation; the product packages never import sibling repository source. `consumer` installs the actual packages in a new directory, compiles the mobile entry and runs a system-only consumer with no UI/Engine/NativeScript installed. `fresh` aliases this consumer check; it does **not** claim a clean native SDK/toolchain build.

Build from `artifacts/ui-validation/mobile` with NativeScript CLI 9.1.1, Core 9.1.1, iOS/Android runtime 9.0.3, webpack 5.0.38 and TypeScript 5.7.3. iOS requires Xcode and your own signing team; Android requires JDK 21 and SDK 36. `App_Resources` is committed in this example. No signing identity is committed.

```sh
node node_modules/nativescript/bin/tns build ios --for-device --team-id YOUR_TEAM --profileDir .ns-profile --disableAnalytics
node node_modules/nativescript/bin/tns build android --profileDir .ns-profile --disableAnalytics
```

For devicectl installation use the actual `.xcarchive/Products/Applications/UIValidation.app` or exported IPA; the generated top-level `.app` may be a relative symlink. NativeScript handles this itself when using `ns run`.

`Acceptance.swift` + `project.rb` create a separate XCTest runner. Set `IOS_TEAM_ID`, generate the project in an artifacts directory, then run on the target UDID. It covers English typing, the native Done accessory on single-line/multiline inputs (dismiss and reopen), modal cancel/reopen, portrait/landscape, background restore and 50 mount/unmount cycles. It deliberately does not label injected text as physical Chinese IME acceptance. Results include screenshots and accessibility trees.

`android-acceptance.py` uses ADB resource IDs from the native accessibility tree. Pass `--adb`, `--serial`, `--output` and one of `--phase controls|input|lifecycle|cycles`. Run phases sequentially on an unlocked foreground device. Lifecycle checks temporarily rotate the device and restore both previous rotation settings in a finally block. English text injection is not physical Chinese IME evidence.

The application writes `Documents/ui-validation.json` (iOS) / the NativeScript documents directory (Android): accepted state, semantic events excluding the password field, 50-cycle counters and live renderer resources. Android can collect it with `adb exec-out run-as org.haiyue.uivalidation cat files/ui-validation.json`; iOS uses `devicectl device copy from --domain-type appDataContainer --domain-identifier org.haiyue.uivalidation --source Documents/ui-validation.json`.

The iOS report also records input accessory dimensions and window attachment after the keyboard opens, without password contents. `Documents/keyboard-accessory.png` captures only our accessory region, not keyboard keys or candidates. When XCTest cannot connect, launch with `--ui-keyboard-check` to focus the name field after mounting; collect the report and image to distinguish missing layout from missing button rendering. This opt-in probe is only in the demonstration app and does not replace visual or input-method acceptance.

## Physical acceptance

Record each device, OS, package hash, steps and outcome. Do not infer passes from capabilities or screenshots.

1. In 工程名称, use the system Chinese keyboard to compose `haiyue`, choose `海月`, continue with emoji. Ensure candidate confirmation does not submit and unrelated counter updates preserve draft/selection.
2. Select text, copy/paste, undo/redo, then blur to commit. On iOS, the system Done button above the keyboard ends editing; verify dismissal, retained text and reopening. Repeat in the multiline editor and secure field; secure content must not enter logs. Check read-only/disabled behavior in a consumer fixture.
3. Enable VoiceOver/TalkBack, navigate names/values/disabled controls, adjust slider, switch tabs, open/close modal and confirm focus restoration. Restore the user's prior screen-reader setting afterward.
4. Rotate while editing and with a modal open; background/resume. iPad additionally enters/exits split view and checks floating keyboard. State must persist, hit targets stay in safe areas, and padding must not double.
5. Use `50 次清理`; the final status should pass and retired resource counters be zero. Capture process memory before/after and after idle/GC, separating native caches from leaks. Compare interaction p95 against the same-device baseline before accepting the frozen performance budget.

`packages.json` binds both tarballs and the application build inputs to SHA-256 identities. Verification rejects newly added, removed or changed adapter/app inputs until the consumer is prepared again. Device results must match both package hashes and the application identity.

`npm run verify:ui -- --profile mobile` intentionally exits 2 while any device's current package is pending. A screenshot, a successful build, a mock IME event or a renderer resource counter alone cannot make that profile pass. On 2026-10-16 Android testing was paused for ShaderLab, then explicitly resumed by the user. Current device results are recorded in the G06 review.
