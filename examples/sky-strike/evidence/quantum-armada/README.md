# Mission 12 — Quantum Armada

> Historical initial implementation: center-symmetric echoes below the player were superseded by the horizontal-only formation in `../quantum-horizontal/README.md`. The artifacts in this directory retain the original behavior.

Adds explicitly numbered mission 12 after mission 10; there is no fabricated mission 11. The carousel retains ordinal pagination through the 11 available missions; its mission title and gameplay wave use number 12. Victory advances from 10 → 12 → 1.

The timeline includes paired scouts, bombers, stealth fighters, gunships and a Crimson Lance elite, with unpaired dart waves. Each echo derives its position from its owner's current pose around the visible screen center, including the horizontally tracked narrow viewport. Its angular velocity is opposite the real hull. Echoes have no independent health, targetable collision body, rewards or drops: player bullets pass through them and laser targeting only considers real enemies. Bombs can damage the real owner, not its echo. Contact with an echo deals 35 damage (70 for the dreadnought) under the ordinary player invulnerability rules.

Real-body destruction immediately removes its echo and owned quantum shots/lasers, awards score once, and retains ordinary drops/haptics. Offscreen removal, pause, home, and level transition cannot leave orphan ghosts. Counter-rotating hardpoints align muzzle flashes and mirrored projectile velocity with the visible sprite. Quantum shots otherwise use the source weapon's damage.

The 4,200-HP cosmic dreadnought carries six animated cannon mounts; each broadside fires 12 real and 12 quantum bullets. Two real and two mirrored lasers have 1.2 seconds of warning, a 520 ms active interval, and 65 damage, followed by cooldown. Real hull damage uses normal boss rules, including bomb resistance. Killing the real hull removes the spectral battleship and cancels its lasers.

Built-in image generation produced `Games/games/sky-strike/assets/boss-quantum-dreadnought.png`; `assets/quantum-art.md` records the complete prompt. Runtime art is 512×512; the packed sprite data remains below 28 MiB. Cached holographic material pixels preserve each source alpha silhouette and convert all color schemes into blue. Glitch scan bands and occasional offset echoes animate through the engine sprite renderer, with zero per-frame texture uploads. No additional canvas or DOM gameplay GUI is introduced. New names and the immunity hint are available in Chinese, English and Japanese.

## Validation

- Games typecheck and Sky Strike production build pass; all 66 Sky Strike tests pass.
- Seven real Chrome Metal/WebGPU quantum scenarios pass: battle, fleet, active lasers, complete natural-play timeline and victory, narrow Japanese combat, Chinese and English carousel. The full mission reaches natural boss death and stage transition in 159,632 simulated ms with an invulnerable max-blue-weapon fixture. It does not force boss damage. Geometry/collision boundary checks use explicit fixture positions.
- Existing prism battle regression passes, including fixed 7-damage returned shots, 90-damage shards and the transition to mission 12.
- Native typecheck and 9 host tests pass; native build, strict code signature verification, installation and launch succeed.
- On-device diagnostic records 62 samples with both quantum ships, real/quantum bullets, warning and active lasers. It deliberately forces boss death at 12 seconds to check teardown, then confirms mission 1 with zero ghosts. The probe uses `MemorySaveBackend`; normal launch restores the player's career. Native screenshot visually reviewed. No per-frame texture uploads; GPU bytes and exact bundle/source fingerprints are recorded in `build.json`.
- Whole-repository run: 535 tests, 511 pass, 20 skip, 2 existing unrelated MUGEN assertion failures and 2 Petra timeouts under concurrent compilation. Both timed-out cases pass when rerun in isolation. The final new hologram-pixel test is included in the 66-test focused run. Existing failures: `mugen-import-g02.test.mjs:248` byte-exact golden and `mugen-viewer-g05.test.mjs:183` virtual-list slot assertion.

Artifacts describe this dirty local diagnostic build, not a formal release/performance gate. Browser JSON files contain asset provenance and runner details. Native probe verifies actual rendering and lifecycle, not a formal performance benchmark.

## Reproduce

From `Games`: `SKY_CASE='^quantum-' node scripts/verify-sky-native.mjs` and `node --experimental-strip-types --test games/test/sky-strike-*.test.mjs`.

Native launch-only diagnostic: `SKY_QUANTUM_PROBE=1`; optionally `SKY_CAPTURE_FRAME=1`. Probe writes `Documents/sky-quantum-probe.json`. Always relaunch without environment flags for normal play.
