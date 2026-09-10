# Sky Strike: localized controls and animated combat — 2026-09-10

The home gear opens a modal Engine GUI settings panel. Chinese is the default;
English and Japanese apply immediately and persist independently of career saves.
The shared typed catalog covers all six level/Boss names, HUD, weapons, actions,
pause/retry, settings and native startup messages. All supported glyphs are loaded
into the static font atlas. No DOM GUI or frame-by-frame Canvas 2D was introduced.

Generated RGBA art supplies bomb/pause/gear controls, a turret, rotor, tintable
flame and armored hatch. Exact prompts and saved filenames are documented in
Games/games/sky-strike/assets/gui-art.md. The final static pack has 32 sprites.
Flashes follow actual projectile spawn points and distinguish weapon types;
elite/Boss turbines rotate, turrets aim/recoil, propulsion pulses, and carrier bay
doors open during deployment. Boss death adds shockwaves and a 1.4-second decaying
camera shake. The GUI stays stable. Visual state is capped, uses simulation delta
without consuming gameplay RNG, pauses with the battle and clears on restart.

## Validation

- Games and native typechecks passed. 24 focused rules/viewport/locale/effects
  tests and all 6 native tests passed.
- Real Chrome WebGPU fixtures passed for the three languages' settings, localized
  menu/pause screens, language persistence, modal input isolation, wide/standard/
  narrow viewports, bomb/pause skins, player input/cancel, and pause/resume.
- Red/blue/purple weapons, elite, all six Bosses and Boss detonation rendered
  successfully. Representative screenshots were visually reviewed; no golden
  baselines changed. Final carrier hatch received a separate visual check.
- All scene snapshots report static uploads completed and no frame texture upload.
  This verifies rendering behavior, not a sustained thermal/performance benchmark.
- Full Games build passed. The final hatch-only refinement also passed the Sky
  Strike target build. Full repository tests: 456 total, 426 pass, 10 existing
  unrelated MUGEN/UI failures, 20 skip (see full-tests-summary.txt).
- One browser run hit a Chrome DevTools Runtime.enable timeout while the full
  build ran. The two remaining Boss cases passed when retried separately.

## iPhone

The final app built, passed strict codesign verification and installed under
org.haiyue.native.skystrike. The final launch log, device-host.jsonl and captured
frame 120 verify startup: 32 bundled sprites, 3,480 presented frames, and no error events. The native Chinese menu and gear were visually reviewed.
Language persistence and combat interactions were automated in the shared browser
implementation; manual native feedback was requested and remains pending.

build.json records final packaged/source/asset hashes. Existing career data was
preserved. Portrait-only orientation, proportional narrow-screen camera tracking
and 4× MSAA remain enabled. No commits or package publishing were performed.
