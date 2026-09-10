# Native Sky Strike verification — initial port, 2026-09-10

**Historical evidence for the first Canvas 2D port. Superseded by
[gpu-rendering/verification.md](gpu-rendering/verification.md), which documents the
installed direct GPU renderer and purple-space icon.**

Installed as a separate Sky Strike app, org.haiyue.native.skystrike. The built
Info.plist and runtime orientation policy permit portrait only. Spider Solitaire
and the completed native milestone app are separate bundles.

## Device evidence

- Xcode 26.3 / iPhoneOS SDK 26.2. Build, codesign verification and USB installation
  passed. Device reports iPhone 15 Plus / iOS 18.7.3 / Apple A16 GPU.
- NativeScript iOS 9.0.3, Core 9.1.1, Canvas 2.1.18; pinned Engine candidate from
  Spider, with the same audited Canvas dynamic-offset and BufferSource fixes.
- All 6 JSON levels and 21 PNG assets are bundled and loaded from app-local paths.
  Selection/battle rendering does not depend on network fetches.
- Device screenshot shows Engine GUI level selection and the boss image. Runtime
  journal records actual playing state, player motion, bullets, increasing score
  and bomb consumption. The first captured sample reached 1,080 presentations,
  averaging 56.5 presented frames/second, with no error event. This short sample
  is not a formal sustained-performance or thermal acceptance.
- Actual home-screen icon was retrieved with placeholders disabled. It uses the
  existing game's player-fighter image.
- Physical orientation, pause/resume and touch comfort were requested for user
  confirmation. See the final acceptance note below when a response is available.

## Screen behavior

The fixed battlefield is 480×960. A uniform scale uses the full portrait
height, with independent safe-area padding for HUD controls. Wider screens leave centered dark side margins; native GUI stays inside
the field and margin touches do not start flight. Narrow screens crop horizontal
field width and move the view linearly with fighter position. Inverse pointer
mapping preserves touch alignment at every camera offset.

The first candidate used the 430×839 safe-area content size, which classified
this tall phone as slightly wider than 1:2. The final layout extends the drawing
surface across the full screen and keeps HUD controls inside safe insets. Final
native measurements and camera samples are recorded below. Real-browser WebGPU
independently covers 600×960, 480×960 and 360×840.

## Automated validation

Passed:

- Games and Native TypeScript checks.
- 18 Sky Strike rules/viewport tests, including fixed aspect, proportional camera
  movement and pointer projection inversion across six screen sizes.
- 5 native package/orientation, texture-upload and save-runtime tests.
- Real-browser native-presentation fixture at 600×960 (wide), 480×960 (1:2),
  and 360×840 (narrow): GUI start, fighter input, camera tracking, pointer cancel,
  pause and GUI resume. Screenshots were inspected; no golden baseline updated.
- Full Games build, followed by a final Sky Strike target build after the final
  GUI layering change.

Full Games tests: 450 total, 420 passed, 10 failed, 20 skipped. The failures are
existing MUGEN fixture/oracle and UI virtual-list checks, not Sky Strike tests.
This is not described as a passing repository-wide test run. Engine source was
not changed in this port; no package was published and no commit was made.

## Architecture and limitations

The existing battle code rasterizes Canvas 2D. NativeCanvasTextures uploads its
bounded frame texture; SkyStrikeBattleLayer delegates the textured draw to
Engine's image renderer before GuiSystem draws controls. This avoids the battle
image covering GUI shapes. It does not rewrite combat into individual WebGPU
sprites. GPU texture buffers are reused; disposal releases systems, listeners,
input and textures.

Browser DOM handling is isolated behind the presentation interface. Native uses
SkyStrikeGuiHud and injected local level/image/save loaders. It does not emulate
a document or host a WebView. The app reads the full surface dimensions at startup and
supports the supported phones' different portrait sizes; arbitrary live desktop
window resizing is not an acceptance claim. Native input currently owns one
primary finger. Career saving retains the original game's checkpoint semantics,
not mid-sortie continuation.

Evidence: build.json (installed JS/executable, source and bundled asset hashes),
device-runtime.json, device-selection.png, installed-icon.png, browser-wide /
browser-standard / browser-narrow PNG+JSON, and focused/typecheck logs.

## Final full-screen package

Installed and launched successfully after the screen-policy adjustment. UIKit
reports 430×932 logical points at window origin (0,0), with an 860×1864 WebGPU
buffer. The raster viewport is 443×960, yielding a 37-unit horizontal camera
range and a center offset of 18.5. This is now the narrow-screen path on the
physical device as requested. The HUD uses the UIView's top/bottom safe insets;
the final screenshot confirms the selection panel remains safely visible.
No error event occurred in the final startup sample. The earlier career high
score (30,680) loaded in the new package. The prior interactive runtime sample
is preserved as device-gameplay-initial.json and is not presented as a final
full-screen gesture acceptance. User confirmation of the final physical
orientation/lifecycle/gesture checks remains pending.
