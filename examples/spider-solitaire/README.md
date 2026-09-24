# Spider Solitaire — native iOS

2026-09-19：经用户授权，手机上的 App 已卸载并换装日历拼图。卸载前完整备份了 44 个本地文件（含存档 Preferences），校验清单和数据保存在忽略目录 `artifacts/backups/20260919-before-calendar-puzzle/`，不纳入版本控制。

The existing `games/spider-solitaire/SpiderSolitaireGame.ts` runs on Haiyue
Engine through NativeScript Canvas/wgpu/Metal. The app has its own bundle ID,
`org.haiyue.native.spidersolitaire`, and home-screen name **蜘蛛纸牌**.

The rules, 3D table, card meshes, picking, animation, difficulty and undo are shared
with the browser game. Engine GUI renders difficulty/deal/undo/new-game buttons
and all status/help text in a topmost 2D layer. Canvas 2D rasterizes card textures
and the GUI font atlas; `NativeCanvasTextures` supplies RGBA pixels without a DOM.
The table uses a radial green gradient. The default camera radius is 720 with a
27° angle from the table normal; its range reaches 4.5° from the normal. No browser DOM or WebView hosts the game. Saves use Engine's
injectable save backend with scoped NativeScript application settings.

The icon was provided by the user on 2026-09-10 and resized from 447×447 to
1024×1024 as the source for iOS PNG icon resources. It is stored at
`assets/app-icon.png`.

## Build and install

Prerequisites match `../ios-pbr-orbit`: Node 22+, Ruby 4.0.6/Bundler, Xcode,
CocoaPods 1.17.0, and a development signing identity. NativeScript iOS is pinned to
9.0.3 for compatibility with Canvas 2.1.18. The checked-in Engine tarball is the
local development candidate built from Engine with additive GUI font canvas/pixel
callbacks (ADR 0100). See vendor/engine-candidate.json for provenance.

```sh
npm ci
bundle install
npm run typecheck
npm test
# Create ignored App_Resources/iOS/signing.local.xcconfig:
# DEVELOPMENT_TEAM = <your team>;
IOS_DEVICE_UDID=<connected-device> npm run build:device
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun devicectl device install app \
  --device <connected-device> platforms/ios/build/Debug-iphoneos/spidersolitaire.app
```

`orientation.json` fixes this game to both landscape directions. The build wrapper
synchronizes Info.plist; the bridge also applies the runtime restriction. See
`../../bridge/display/README.md` for portrait and flexible hosts.

The application imports the bundled `games/` source in this repository. TypeScript and webpack resolve its Engine imports through this application's pinned dependencies. A sibling Games checkout is not required.

## Verification and diagnostics

`SPIDER_CAPTURE_FRAME=1` as a launch environment variable saves frame 120 to
Documents/spider-frame.png. A bounded Documents/spider-host.jsonl records native
GPU failures, surface size, lifecycle, input ownership and game counters. These
are application diagnostics and do not require system recording. Normal launches
have frame capture disabled. `SPIDER_TRACE_STARTUP=1` records font rasterization
and first-frame milestones without modifying native GPU objects.

The build applies hash-checked Canvas 2.1.18 JavaScript binding fixes for dynamic
uniform offsets and writeTexture BufferSource normalization. The latter preserves
view byte ranges and adapts ArrayBuffer/DataView to the TypedArray required by
the package’s iOS C++ implementation; it fixes the GUI atlas first-frame crash.

One finger drags cards or rotates the empty table. Two fingers zoom through
Engine OrbitControl. Adding a second finger cancels card/GUI interaction; lifting
one finger ends the pinch without handing rotation to the remaining finger.
All fingers must lift before a fresh gesture. HUD areas do not start camera input. Backgrounding stops rendering and flushes queued saves. Relaunch loads
the latest saved board; undo history, as in the browser version, is session-only.

Device evidence and check outcomes are in `evidence/verification.md`.

Rendering uses 4× MSAA. Surface sizing and picking share UIKit's actual view
bounds; NativeScript's measured safe-area dimensions are retained only as
diagnostics, since an iOS view may draw outside that measurement.

## Automatic saving

A move, deal, undo, new game or difficulty change immediately queues the committed
board to the Engine autosave slot. Backgrounding flushes queued writes. Restart
restores card order, face-up flags, stock, difficulty, completed runs and moves.
Transient drags/animations and undo history are not serialized. The HUD displays
Saving..., Autosaved, or Save failed; a failed write is retried on the next board
change and must never be shown as saved.

NativeScript iOS 9.0.3 lacks structuredClone required by GameSaveService. The app
supplies pinned core-js-pure 3.50.0 through bridge/storage/clone-runtime.ts only
when the native runtime lacks the operation. It does not replace existing
implementations or modify Engine's save format. Earlier native builds could
render correctly while their background save promises failed; the autosave
verification supersedes earlier assumptions about persistence.
