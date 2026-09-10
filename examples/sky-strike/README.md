# Sky Strike — native iOS

A separate portrait-only app (`org.haiyue.native.skystrike`, display name Sky Strike)
using the shared Games Sky Strike rules, all seven levels and a predecoded RGBA sprite pack.
It does not replace Spider Solitaire or the native PBR milestone app.

The browser and iOS app share one visible WebGPU canvas. Haiyue Extensions'
`experimental/indexed-sprite` renderer batches ships, bullets, lasers, shield rings,
explosions and stars directly on the GPU. Static atlas uploads happen at startup;
there is no Canvas 2D battlefield, frame readback or full-screen texture upload.
Engine GUI draws the entire interface, including level selection and in-game HUD.
The compact HUD centers current/best scores in two rows, shows armor as a shield
with a clockwise health ring and remaining lives as mini fighters on the left,
and conditionally places the current Boss portrait/health ring on the right.
It respects safe areas and scales text to stay between the two gauges.
Native Canvas 2D is used only once to build the Engine GUI's font atlas.

The icon and mission-selection background use generated deep-purple space art.
See `assets/image-generation.md` for prompts and provenance. The later generated button and pause-panel skins are documented in `Games/games/sky-strike/assets/gui-art.md` (studio-relative), with verification in `evidence/gui-skins/`. Sprite conversion is
reproducible with `python3 Games/scripts/pack-sky-sprites.py` (Pillow required), run
from the studio root after editing source PNGs. `assets/sprites.json` validates byte
ranges into `sprites.rgba`; both platforms upload those same pixels.

The renderer intentionally consumes the public experimental indexed-sprite subpath;
its pinned local Extensions and animation-spec tarballs are bundled in `vendor/`.
No new Engine API or shader is introduced. The bridge supplies the standard
`GPUColorWrite` mask when Canvas 2.1.x does not expose it.

## Layered scrolling space

Each of the seven missions has its own generated 512px starfield/nebula texture:
navy, crimson, violet, amber, teal, emerald and red/blue. Independent 384px ice-planet
and ringed-planet layers decorate selected missions. Exact built-in imagegen prompts
and master PNG names are recorded in `Games/games/sky-strike/assets/space-art.md`.

`spaceBackdrop.ts` composes far stars at 7 logical pixels/second, diffuse dust at
19 px/s, planets at 11 px/s, and the existing faster foreground particles. Layers
respond differently to the horizontal camera and player movement, while the
portrait viewport and wider-screen margins retain their existing rules. Mirrored
vertical repeat guarantees shared edge texels; planet recycling occurs fully
outside the viewport. Pause freezes the new layers and transition clock.

Completing a mission starts a 9-second smooth alpha crossfade to the next theme.
Travel continues during the fade; normalized weights preserve exposure and remain
continuous if another transition interrupts. A fresh sortie starts directly in its
selected theme. All textures upload once at startup; animation changes only draw
transforms and opacity, with no raster canvas work or per-frame texture uploads.

The pack contains 46 sprites / 25,224,704 bytes (26 MiB budget), an 8,519,680-byte
increase for nine new layers. Measured battlefield atlas allocation is 31,129,152
bytes across three 2048-limited pages, excluding GUI/fonts and render targets.
See `evidence/space-backgrounds/` for screenshots, continuity checks and build/device
verification. Raw PNG masters are not duplicated in the native app bundle.

## Seventh mission: Binary Nova

The level-07 timeline introduces the Fission Cruiser, then spawns Chromatic Twins
as one encounter with two independently damageable red/blue hulls. Each hull has
1,800 HP. When one reaches zero it stops firing and leaves a visible wreck; the
player has 5 seconds of active gameplay to defeat its partner. Otherwise only the
downed twin revives at 20% HP. Pause/background freeze the timer. Both down ends
the encounter once, including simultaneous bomb kills. The HUD shows two colored
portrait rings and a localized revival countdown; the carousel previews both hulls.

Each twin fires matching ordinary bullets and 24-HP bubble projectiles. Player
bullets and the purple laser can safely pop bubbles; bombs clear them. Same-color
bubbles pass through one another. Opposite-color bubbles consume each other and
explode with a 150-logical-pixel damage radius (55 armor damage), GPU shockwaves,
sparks and camera shake. Bubbles are capped at 24 and recycle outside the field.

Fission Cruisers split into exactly two ordinary scouts when destroyed. Scouts
cannot split again; the elite remains eligible for the carrier's random elite pool.
All new text supports Chinese, English and Japanese. Three generated transparent
masters and their built-in imagegen prompts live in `Games/games/sky-strike/assets/twins-art.md`.
The runtime pack keeps twins at 384px and the elite at 256px. Before the scrolling
background expansion, these 37 sprites occupied 16,705,024 bytes; current totals
are documented below. No frame texture uploads.

Verification: `evidence/twin-boss/` contains real browser checks, screenshots,
source/package hashes and native install/launch evidence for this revision.

## Boss balance

Boss bomb damage is reduced by 70%, including damage relayed by Helios emitters;
ordinary enemy bomb damage stays unchanged. Iron Serpent shares each hit across
its living body sections, redistributing damage when a section runs out of HP.
Its boss health pool receives the total once, and one bomb cannot multiply that
hit by the number of covered body sections. After all sections die, the head
continues receiving damage.

Helios emitters relocate to a different unoccupied location after each laser's
active phase ends, with arrival/departure flashes and a fresh firing cooldown.
They do not move during the warning or active beam, or land on the player.
Carrier deployments run every 3 seconds (previously 4.6); each third successful
small-plane wave summons a random elite if fewer than two elites are alive.
A full elite roster skips that summon without accumulating deferred spawns.
The bay-door animation uses the same deployment interval.

The top HUD background uses 40% opacity. Verification for this revision is in
`evidence/boss-balance/`.

## Screen adaptation

The logical battlefield remains 480×960 (1:2), measured against the full portrait drawing surface; HUD controls separately
respect iOS safe-area insets. One uniform scale preserves geometry:

- At 1:2 the whole field fills the viewport.
- Wider viewports center the complete field and leave dark empty side margins.
  The HUD stays inside that field; touches in the margins do not start gameplay.
- Narrower viewports retain the full logical height and crop horizontally.
  Camera offset varies linearly from zero to the hidden field width as the
  fighter crosses its horizontal movement range. Pointer coordinates use the
  inverse transform, so the fighter remains under the finger while the view moves.

`Games/games/sky-strike/viewport.ts` is shared by browser/native rendering and
input. The projection reads current engine display dimensions each frame; native GUI placement also respects safe-area insets.

## Input and lifecycle

Select a level with arrows/swipes, then tap 开始出击. Hold/drag on the battlefield
to move and fire. BOMB launches an available bomb; PAUSE/RESUME controls the game.
The current native adapter owns one primary finger per gesture. Cancellation
stops firing. Backgrounding cancels input and pauses; return and tap RESUME.
The pause panel also offers 返回首页 / MAIN MENU / ホームに戻る. Returning ends the current sortie, saves career statistics, clears battle effects/input, and opens level selection at the current mission. Relaunching starts a fresh sortie. See `evidence/return-home/` for verification.
Listeners, the World, GUI resources and game textures are released on disposal.
Career statistics use the existing Engine autosave policy and NativeSettingsStorage;
this port does not add mid-sortie resume/save semantics.

## Language and combat presentation

The home-screen gear opens an Engine GUI options panel. Chinese is the default;
English and Japanese apply immediately and persist in `sky-strike.language.v1`
through NativeSettingsStorage (localStorage in the browser), independently of
career saves. The static font atlas includes every supported language before the
first frame. Level/Boss names, HUD, weapons, buttons, pause/retry, settings and
startup messages share one typed catalog. The modal blocks underlying carousel
swipes and keyboard launch actions.

Generated bomb, pause and gear icons retain live localized captions. Generated
flame, turret and rotor sprites add distinct weapon muzzle effects, articulated
elite/Boss attachments and pulsing propulsion. The carrier's bay opens during
deployment. Boss destruction adds a 1.4-second damped camera shake and expanding
shockwaves; only the battlefield moves, so GUI/input coordinates stay stable.
Effects use bounded state and clear on restart/disposal; no gameplay RNG is used.

See `evidence/i18n-fx/verification.md` for tests, screenshots and package hashes.
Source assets and exact built-in image generation prompts are in
`Games/games/sky-strike/assets/gui-art.md` (studio-relative).

## Build

Use the same Xcode/Ruby/NativeScript toolchain as Spider Solitaire. Dependencies
are independently locked; the public Engine candidate and audited Canvas binding
patches match the already validated native setup. Engine source is unchanged by
this port.

```sh
npm ci
bundle install
npm run typecheck
npm test
# Create ignored App_Resources/iOS/signing.local.xcconfig with DEVELOPMENT_TEAM.
IOS_DEVICE_UDID=<connected-device> npm run build:device
```

The prepare script stages only the RGBA pack, its index and seven level JSON files
into ignored `src/game-assets`, which webpack bundles as `app/game-assets`. It
removes stale generated art from staging/output directories. Original PNG masters
remain in Games for editing; they are not duplicated in the app bundle. Runtime
loading is local and offline. Small art is downsampled according to actual display
size; GUI-only sprites stay out of the battle atlas. A 2048px atlas page limit
reduces sparse space without increasing representative combat draw-call counts.
See `evidence/compact-hud/` for byte counts, screenshots and native verification. `orientation.json` generates portrait-only Info.plist values
and configures the shared orientation bridge.

`SKY_CAPTURE_FRAME=1` saves presented frame 120 to Documents/sky-strike-frame.png.
Documents/sky-strike-host.jsonl contains bounded readiness, input, lifecycle and
presentation samples. Diagnostics do not record device identifiers. Verification
results and package/source hashes are in evidence/.
