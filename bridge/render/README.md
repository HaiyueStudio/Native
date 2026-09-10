# Native render adapters

`NativeSurface` provides the structural canvas and GPU provider expected by
Haiyue Engine, with explicit native surface presentation. `nativeViewRect` is the
shared coordinate boundary for rendering and input: UIKit logical points using
the actual drawing view bounds and its window origin. Do not substitute the
Canvas package's measured `clientWidth/clientHeight` for the view's bounds; on
iOS these can differ when safe-area overflow is enabled.

`NativeCanvasTextures` provides offscreen Canvas 2D glyph rasterization and
explicit RGBA uploads for games using procedural card/HUD textures. It caches
one GPU texture per caller key and size, writes updates in place, and releases
its owned textures at teardown. It is not a document/window polyfill. Pass its
callbacks through game platform options and dispose it before destroying the
host's GPU device.

`NativeRenderHost` accepts optional canvas input, scene setup/cleanup and render
options such as `msaaSamples: 4`. Scene cleanup runs even if initialization fails
before input binding. Applications still own their scene/save/input policy.

For Engine GUI, pass `createCanvas2D` as `GuiFontOptions.canvasFactory` and
`readAtlasPixels` as `GuiFontOptions.readAtlasPixels`. Engine owns the resulting
font GPU atlas and disposes it with the GUI renderer; the bridge only owns its
separately cached game textures. The default browser DOM path is unchanged.
