# Native Spider Solitaire verification — 2026-09-10

Status: installed, rendering verified, and user confirmed interaction normal.
After that confirmation, the requested more saturated green felt was installed
and visually checked in a fresh device capture. No interaction code changed in
that final color adjustment.

## Delivered behavior

- Shared Games Spider rules, animation, save backend, picking and undo.
- Engine GUI difficulty/deal/undo/new-game buttons; status and help in topmost 2D.
- Two-finger OrbitControl zoom, primary card/GUI cancellation on second finger,
  and no remaining-finger rotation after the pinch. Three fingers and background
  interruption cancel the gesture. The PBR host keeps its default primary-only input.
- Camera radius 720 (previously 820), default angle 27° from table normal, minimum
  4.5°; radius limits 540–1080. Green radial felt with stronger saturation.
- 4× MSAA; rendering and picking both use actual UIKit view bounds.
- Landscape left/right via shared bridge policy and generated Info.plist.
- User-provided icon, actual installed icon independently retrieved without placeholders.

## Device validation

Xcode 26.3 / SDK 26.2; NativeScript iOS 9.0.3, Canvas 2.1.18, Core 9.1.1.
Device reports iPhone 15 Plus / iOS 18.7.3 / Apple A16 GPU.
Build, codesign verification and USB installation passed for the final package.
The final capture is 1628×818; the sampled journal reached 2,280 presented frames
without an error or capture-error event. This establishes rendering and the
sampled run, not a new formal long-duration performance acceptance.

The user tested pinch and remaining-finger release, card picking/dragging,
GUI actions, camera rotation and background/resume, then replied: “操作正常。就是桌布的绿色能够更纯一些，目前有点泛白”. The final color adjustment follows that feedback.
They did not separately rate antialiasing; 4× MSAA is configured and the fresh
render is attached, but this record does not invent a subjective MSAA verdict.

The first GUI candidate crashed at its first frame. Canvas 2.1.18's JavaScript
GPUQueue.writeTexture forwarded an ArrayBuffer to an iOS C++ implementation that
unconditionally casts its data to v8::TypedArray. A version/hash-checked build
patch normalizes BufferSource to a Uint8Array while preserving byte ranges and
layout offsets. The same GUI path now renders on the device. Tests cover raw
buffers, sliced typed arrays and DataView. Existing dynamic-offset patch remains.
Temporary GPU-method instrumentation also encountered read-only native methods;
that instrumentation was removed. Optional startup tracing now records only
font rasterization and the first completed frame.

## Automated checks

Passed:

- Native TypeScript and 6 tests, including the actual Engine OrbitControl fed by
  the NativeTouchInput adapter through pinch, third-finger and lifecycle cases.
- Existing PBR bridge suite: 23 tests.
- Engine root TypeScript and all 1,248 root tests, including 618 engine tests.
- Engine DOM-free GUI font atlas tests: factory, upload caching and GPU cleanup.
- Engine module boundaries (446 files) and renderer-prepare checks (21 renderers,
  10 postprocess modules).
- Focused Engine browser example build: GUI runtime, OrbitControl, MSAA, and fog.
- Games TypeScript, full Games build, Spider target build, 9 focused Spider tests;
  shared single-slot save coverage also passed in the earlier focused run.
- Deterministic real-browser WebGPU fixture: RGBA GUI atlas upload, GUI deal,
  undo and difficulty switching; fresh screenshot after the final color change.

Incomplete or failed repository-wide gates:

- Engine full build stopped at the fog example's build timeout. Fog and relevant
  examples passed a subsequent focused build; the full build is not marked passed.
- Engine API/responsibility checks require the missing sibling Editor repository.
  No fake workspace or baseline changes were used to bypass them.
- Public-package verification first timed out installing its packed consumer;
  the network-enabled retry stopped in the separate UI production build. It is
  not marked passed. The native app's pinned Engine package itself built,
  typechecked, signed and rendered successfully.
- Games full tests: 446 total, 416 passed, 10 failed, 20 skipped. Existing failures
  concern MUGEN fixture/oracle and asset-viewer/virtual-list checks; none is Spider.
  Games requests UI >=0.1.2, while the available local UI is 0.1.1. Validation used
  local UI with --no-save; dependency declarations and UI source/version were not
  changed. Native Spider does not depend on UI.

The Engine font options are an unpublished local candidate described in ADR 0100,
with unchanged root exports. Publishing still needs the stable API minor-release
review; this task did not publish packages.

## Evidence

- device-gui.png: final device frame, more saturated green felt.
- browser-gui.png / browser-gui.log: deterministic GUI browser verification.
- device-runtime.json: selected final startup/presentation diagnostics.
- build.json: final installed JavaScript, executable and source hashes.
- vendor/engine-candidate.json: Engine candidate provenance (one directory above).
- native-tests.log / bridge-tests.log / spider-tests.log and typecheck logs.
- installed-icon.png: actual installed icon, not an asset preview.

Only Spider's landscape behavior was physically tested. Portrait and flexible
bridge policies have unit coverage, not separate installed-device acceptance.
Icon assets use bundled PNG resources and CFBundleIcons because this Mac's
AssetCatalogSimulatorAgent stalled compiling an icon catalog; historical M16
artifacts were not altered.

## Autosave follow-up

The request to add automatic saving exposed a native runtime gap: the earlier
board-state save calls failed because GameSaveService requires structuredClone,
which NativeScript iOS 9.0.3 does not provide. The user confirmed Save failed in
the first status-indicator build. The compatibility build pins core-js-pure 3.50.0
and installs this operation only when absent. It now reports saved and produces
an actual app preferences file containing one Engine autosave envelope.

Saving..., Autosaved and Save failed reflect the newest queued write; older
write completions cannot mark a newer pending board saved. saveNow shares the
serialized queue and still rejects on write failure. Subsequent board changes
retry after a failure. Browser restart verification checks complete card order,
stock, difficulty and move counts. Native tests reproduce Engine save failure
without structuredClone and verify successful save/load after installing it.

This run: Games/Native typechecks passed; 15 focused Spider/save tests and 7
native tests passed. Full Games build passed; full tests contain 417 passes,
10 known unrelated failures and 20 skips (447 total). See autosave-checks.json.
The prior Engine-wide gate limitations above are unchanged by this follow-up;
Engine source was not changed for the autosave fix.

Final device acceptance: user confirmed 自动保存功能已经正确了. After terminating
and relaunching the app, all ten columns (card IDs/order/face-up flags), stock
count, difficulty, completed runs and moves matched the persisted revision
6 exactly. The saved board contained 5 moves and 50 stock cards.
Restored status is saved, with no error event in the sampled run. See
autosave-device.json and autosave-device.png.
