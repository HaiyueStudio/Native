# Compact HUD and resource budgets — 2026-09-10

The in-game header replaces title/weapon/wave/linear bars with two centered score
rows, a left armor icon/clockwise health ring, one miniature fighter per remaining
life, and a right Boss portrait/health ring only while a Boss exists. The Boss
portrait uses a central UV crop from its existing preview texture. All components
use existing public Engine GUI primitives; no new renderer, DOM or Canvas 2D
rasterization was added. The 90-point header and input exclusion respect iOS safe
areas. A dark translucent backing maintains contrast against bright Boss art.
Text fits the available center column, including a 280px-wide Japanese fixture.

The pause dialog retains Continue and Return Home. Return Home saves career
statistics, clears battle/input/effect state and returns to the current mission.
The Chinese replay fixture still passes two return/relaunch cycles.

## Resources

Small controls/effects are now packed at display-appropriate long-edge sizes:
life 48px, shield 96px, gear/rotor 128px, action icons 160px, turret/flame/hatch
192px, ordinary ships 256px. Boss art retains 640px and the background 1024px.
PNG masters stay in Games for editing. Native staging includes only the pack,
index and six JSON levels, and removes stale generated PNG copies.
GUI-only art is excluded from the battle atlas. Its page limit is 2048px, reducing
shelf-packing waste; representative red-fire draw calls remain 137 before/after.

| Metric | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Raw RGBA pack | 20,281,344 B | 15,263,232 B | 24.74% |
| App game resource files | 80,389,529 B | 15,275,004 B | 81.00% |
| Battle atlas GPU allocation | 32,087,784 B | 17,365,456 B | 45.88% |

These are resource measurements, not total app size or total GPU memory. Font
atlas, GUI texture cache, render targets and frameworks are excluded from the GPU
comparison. The reduction lowers bytes to load/upload; startup latency was not
benchmarked under controlled thermal/cache conditions. Exact counts and hashes
are in resources.json and build.json. The final package has 8 game resource files,
34 logical sprites and no original PNG duplicates in game-assets.

## Verification

Games/native typechecks, 26 Sky Strike tests and 7 native tests passed. Real Chrome
WebGPU cases cover full/half/quarter/zero health, 0–3 lives, conditional Boss UI,
centered long scores, Japanese narrow layout, menu, pause/home, input/bomb behavior,
red fire, carrier animation and Boss explosion. Screenshots were visually reviewed;
no golden baselines changed. Static uploads are complete; per-frame image uploads
remain zero.

The first full Games build timed out at unchanged Pong. Resuming its remaining
seven games with a 180-second allowance passed, covering all 23 manifest games.
The repository-wide test run recorded 456 total: 421 pass, 10 existing unrelated
MUGEN/UI failures, 5 MUGEN timeouts/cancellations and 20 skips. Focused current Sky
Strike checks passed separately; this is not a claim of a green full test suite.

The final app built, passed strict codesign, installed and launched on iPhone.
Its fresh journal reports 34 sprites, 7,680 presented frames, the reduced atlas
allocation and zero error events. Manual native HUD/interaction feedback was
requested and remains pending. Prompts for the new shield/life PNGs are documented
in Games/games/sky-strike/assets/gui-art.md (built-in image generation tool).
