# Native 0.2.0 development candidate

Date: 2026-10-13. **Not a published or release-qualified version.** Published 0.1.4 and its frozen manifest are preserved.

P0 added a Deno/V8 + GLFW desktop host using native wgpu, without a WebView, and an Engine-independent achievement facade. P1 now adds Steam/Game Center provider implementations, GameKit's iOS/macOS native bridge, a developer-supplied Steamworks C ABI build path, and the optional Engine achievement rules/GPU GUI. The public Rubik uses first solve, ten solves, timed 3×3 and hidden mirror rules. Gameplay and platform synchronization remain separate; cached SDK acceptance does not claim server durability.

The default example is local. Steam requires the licensed SDK, published App ID/stat/achievement configuration, client and test users. Game Center requires app IDs, capability, entitlements, profiles and App Store Connect achievements. None of these platform configurations is available yet. The Steam C++ source is therefore **not SDK-compiled or SDK-frozen**; GameKit compilation and mock tests are not real platform acceptance.

Native's pure system/achievement entries import no Engine. The optional `@haiyue/extensions/achievements` package is injected by the game; it contains no Native dependency. New public Native subpaths: `achievements/steam`, `achievements/game-center`, `achievements/game-center/native`, `achievements/game-center/build`. Desktop FFI adapters remain in the source host, separate from the npm system package. npm packaging excludes games, desktop executables, SDK bundles and evidence.

Use `npm run release:verify -- --profile development --desktop` for current source checks and real local GPU probes; add `--platform ios|android` for mobile preparation. This profile writes development reports separately from immutable 0.1.4 manifests. `desktop/verify:fresh` builds in a fresh source directory using pinned archives and a new npm cache. The extension archive carries a `-p1` filename plus a SHA-256 identity; its manifest still identifies the development source baseline as 0.2.1. It must not be uploaded as the already-published 0.2.1 package; assign the independently reviewed extension release version before publication.

Release gates still include Windows x64 and Apple Silicon hardware, real Steam and Game Center acceptance on their required platforms, current mobile interactions/regressions, three warmed same-quality Web/native-TS/Rust performance rounds, and complete transitive Deno/Skia binary notices/SBOM. The existing ATT restricted physical-device item is retained. Current ad-hoc macOS development signing does not qualify for Game Center distribution or public notarized release.

See [P1 results and pending matrix](../desktop/evidence/p1/README.md), [platform setup](../examples/achievements-validation/README.md), and [Windows handoff](../desktop/WINDOWS-HANDOFF.md). No npm publish, tag, push or store upload is performed by this work.
