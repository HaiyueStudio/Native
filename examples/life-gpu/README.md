# Engine Life GPU comparison host

Experimental iPhone/Android host for `RustNative/comparison-life/core.js`, using the frozen public Engine package snapshot and the existing Native Canvas bridge. It has a separate application ID (`org.haiyue.native.lifegpu` on iOS, `org.haiyue.games.lifegpu` on Android), starts the full benchmark automatically, and never loads game/model assets.

Prepare the comparison snapshot first: `node ../../../RustNative/comparison-life/prepare.mjs` and `node ../../../RustNative/comparison-life/freeze-engine.mjs --copy`. Install dependencies with `npm ci`. The local measurement reused an existing matching NativeScript tool installation through a node_modules symlink; webpack aliases still select the frozen Engine 0.2.1 artifacts rather than the installed Engine 0.1.0 package.

- iOS: `IOS_TEAM_ID=<your-team> IOS_DEVICE_UDID=<your-device> node scripts/build-device.mjs`. Builds Release. `--js-only` reuses the already prepared native project.
- Android: use `node scripts/android.mjs build android --release` with your local test keystore options and `--env.production`. The comparison uses the local Android debug keystore for test signing; it is not a store release.
- iOS exports `Documents/engine-life.json` and a native GPU frame `Documents/engine-life.png` after completion. Android exports `engine-life.json` to its private files and app-owned external-files directory for non-debuggable Release collection.
- Results include device details, actual physical surface dimensions, validation, every measured frame and all final grid digests. They contain no user game data. On background the benchmark is aborted.

See the comparison README and evidence report for workload and interpretation limits. This host is not added to the public Native release manifest, npm payload, or existing six-example acceptance baseline.
