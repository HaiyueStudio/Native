# Desktop GameKit bridge

`node desktop/platform-libs/game-center/build.mjs` compiles the shared Swift implementation and C ABI shim with Xcode. It emits `desktop/build/libhaiyue_game_center.dylib`. The JS client calls it synchronously on the Cocoa main thread, with GameKit callbacks queued as JSON. ABI v1 exports start/session/request/poll/stop; the bridge is exclusively owned by one client at a time.

For a configured and properly signed .app, run with `--provider=game-center --bundle-id=ACTUAL_BUNDLE_ID --platform-library=/absolute/path/to/libhaiyue_game_center.dylib`. CLI Deno's bundle identity is not your Game Center app identity. Copy/sign the library inside the application's package and use its actual Bundle ID, Game Center entitlement and provisioning profile. The generic development .app's ad-hoc signature is not a valid Game Center distribution signature. Default local packaging intentionally does not enable the entitlement or claim Game Center availability.

The bridge checks `Bundle.main.bundleIdentifier` and refuses a mismatch. Login cancellation returns guest; signed-in identity uses game-scoped player ID, not nickname. The Game Center dashboard uses a Cocoa presentation controller on the current window. The dynamic library remains mapped until process exit to keep delayed Swift callback code alive.

Both iOS and macOS code paths compile locally; actual standalone macOS authentication/presentation has not been accepted. Required tests are listed in the provider guide and `examples/achievements-validation/README.md`.
