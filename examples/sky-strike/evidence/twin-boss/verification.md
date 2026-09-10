# Seventh mission — red/blue twins

The seventh mission adds two colored Boss hulls and a splitting elite. Generated transparent masters and exact built-in imagegen prompts: ../../../../../Games/games/sky-strike/assets/twins-art.md (studio source path documented in README).

## Behavioral coverage

Real WebGPU browser fixtures exercise the production game instance:

- Primary spawn creates exactly two independently damageable Boss hulls.
- First defeat starts 5,000 ms revival window; at 4,999 ms the hull stays down; at exactly 5,000 ms it revives at 20% HP. Survivor HP is unchanged. Pause freezes the clock.
- Killing the survivor inside the window advances the level and records a single Boss encounter victory. Simultaneous bomb kills also complete correctly.
- 24-HP bubbles survive five 4-damage hits and pop on the sixth. Actual bullet collisions consume the bullet; purple laser can target bubbles.
- Red/blue bubbles detonate with a 150px blast (55 armor damage). Both bubbles are removed; no repeat damage next frame. Same-color bubbles do not detonate.
- Matching normal projectile colors; at most 24 active bubbles.
- Elite death produces exactly two ordinary scouts; scouts do not split again.
- Returning home clears twins, bubbles and revival timer.
- Separate twin portrait rings/countdown, three-language paired carousel, and Japanese narrow-screen HUD visually reviewed. Live enemy movement/firing rendered through the production update loop.
- Existing balance, narrow input/camera, ordinary HUD and menu cases still pass.

Games/Native typecheck passed. Sky Strike Node checks: 27 passed. Native tests: 7 passed. Native build, strict signature verification and install passed; packaged level-07 and sprite pack match source hashes. No screenshot golden changed. Runtime images are 37 static sprites, 16,705,024 bytes (below 16 MiB), with 384px twin hulls and 256px fission elite.

Full repository tests: 429 passed, 10 failed, 20 skipped (459 total). The ten failures are the same pre-existing MUGEN/UI evidence and fixture failures seen before this change.

All 23 Games targets built successfully. Device frame 120 captured and reviewed, 133 frames observed with no error/failure journal events. Phone combat feel remains for user playtesting; no user acceptance claimed.
