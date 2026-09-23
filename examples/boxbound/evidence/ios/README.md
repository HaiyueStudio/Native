# Boxbound on iPhone

Device: iPhone 15 Plus, iOS 18.7.3. NativeScript 9.0.3, Canvas 2.1.18, Haiyue Engine Metal renderer. Bundle ID: org.haiyue.games.boxbound.

The app uses the shared game scene/rules/GUI. Native platform resolution selects UIKit touch, bounds and AVAudioEngine sound playback. Input attaches after Canvas ready; Android-only APIs are guarded. Eleven existing PCM sounds are resampled to 44.1 kHz at packaging time. Existing Android icon polygons are rasterized at iOS icon sizes.

Fullscreen uses iosOverflowSafeArea on both the scene container and Canvas. The 3D viewport fills the display; fixed HUD controls separately respect current native safeAreaInsets. Two additional device checks verify full screen bounds and button margins.

Smoke uses isolated saves. Pointer coverage exercises the common Engine pointer entry; it does not synthesize UIKit touches. Native UIKit observer attachment, Metal rendering, audio playback, gameplay, mirror orientation, undo, quality settings and checkpoint saves are also checked. Normal launch terminates the test process and restores the real save namespace.

Evidence: smoke.jsonl (initial 24 checks), fullscreen-smoke.jsonl (fullscreen bounds and safe controls passed; 18 checks completed before a recorded 35-second background suspension interrupted the remaining gameplay replay), rendering PNGs, normal.jsonl, validation.json, build logs and 15 passing focused native unit tests. Engine sources were not changed.
