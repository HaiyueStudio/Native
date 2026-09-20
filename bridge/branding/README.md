# Haiyue Engine loading screen

Shared NativeScript loading overlay, first integrated into calendar-puzzle (iOS + Android).

- `assets/haiyue-moon-master.png`: AI-generated glass crescent, based on the user-provided silhouette; transparent RGBA master.
- `assets/haiyue-moon.png`: 384 px deployment derivative (~127 KiB). Keep the master out of the application bundle.
- `engine-splash.ts`: dark navy full-screen native overlay, icy-blue moon, HAIYUE ENGINE wordmark, device-language loading/failure copy. Native UI is available before the GPU engine initializes.

Copy the deployment PNG to `branding/haiyue-moon.png` using the app's webpack copy rules. Construct `NativeEngineSplash` over the canvas inside its GridLayout. Call `presented()` after actual surface presentation, not merely after scene creation. Call `fail()` on initialization/render failure and `dispose()` on page teardown. The fade is 180 ms; there is no artificial minimum startup delay or looping animation/timer.

Other native games can opt into the same class/asset. This component is the in-app engine loading screen; it does not replace the OS-managed launch screen or the game's app icon. Those remain separate platform/store resources.

Generated 2026-09-20 using imagegen. Source reference: codex-clipboard-d5dc03ec-570a-48f9-8a70-78b7ec3c10eb.png. Prompt: broad left crescent matching the reference, pale-blue translucent polished liuli glass, empty transparent circular hollow, no text or ornaments. Resized for shipping using macOS sips, preserving alpha.
