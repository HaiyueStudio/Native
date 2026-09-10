# Direct GPU Sky Strike — 2026-09-10

Installed and launched on the connected iPhone. One visible WebGPU canvas handles
combat and all Engine GUI. Portrait-only packaging and full-screen 480×960 logical
field semantics are preserved: wider screens pillarbox, narrower screens track
fighter position proportionally. No DOM controls or Canvas 2D battle renderer.

## Rendering and assets

- Reuses the public Haiyue Extensions experimental indexed-sprite renderer, with
  4x MSAA, one static RGBA atlas and instanced batches. No new Engine API/shader.
- Aircraft, bullets, rotating sprites, segmented bosses/devices, beam warnings,
  purple lasers, sparks, impacts, shield rings and bomb blasts use GPU sprites.
  Procedural masks are immutable startup assets; simulation updates transforms.
- Native font rasterization is limited to the GUI's startup atlas. Native image
  loading reads the bundled predecoded RGBA pack directly; combat performs zero
  frame readbacks/full-screen texture uploads.
- New opaque purple-nebula icon verified through the installed app icon API with
  placeholders disabled. Generated mission background and live GUI share the
  purple/cyan styling. Prompts are in ../../assets/image-generation.md.
- Bridge conditionally supplies GPUColorWrite (Canvas 2.1.18 omits that standard
  constant). It preserves an existing provider's implementation.

## Validation

Passed: Games and native typechecks, 18 Sky Strike rules/viewport tests, 6 native
package/orientation/save/binding tests, full Games build and final Sky Strike build.
The full Games test run remains 420 passed / 10 failed / 20 skipped (450 total).
Those failures are the existing MUGEN fixture/oracle and UI virtual-list cases.

Real-browser WebGPU: wide 600×960, standard 480×960, narrow 360×840; GUI start,
input, camera movement, pointer cancel and pause/resume pass. Additional captures
cover the generated menu, purple laser, pickup and all six bosses with impacts.
Combat fixture injection is confined to test code and runs in the real Engine
frame loop. Representative screenshots were inspected; no golden was overwritten.

Native build, strict codesign verification, installation and launch passed. Runtime
observed 2,640 presentations at 860×1864 pixels / 430×932 logical points, with no
error event. The 22-second interactive sample shows movement, firing and score
changes, with approximately 60 presented FPS. Atlas uploaded bytes remain exactly
26,288,704 throughout the sample. This short sample is not a sustained thermal
benchmark. The actual menu frame and installed icon are included here.

Career statistics restore through the prior native save backend; mid-sortie save
semantics are unchanged. Physical play feel and final GUI acceptance were requested
from the user; automated success does not substitute for that response.

## Evidence

- build.json: installed executable/JS, sprite pack, source and vendor hashes.
- device-runtime.json/jsonl: sample statistics and bounded app-owned journal.
- device-menu.png, installed-icon.png: actual device outputs.
- browser-*.png/json: real GPU fixture screenshots and HTTP/source provenance.
- focused/typecheck/build logs in this directory.

The earlier evidence in the parent directory documents the superseded initial
Canvas 2D port, not this installed architecture. No packages were published and
no commits were made.
