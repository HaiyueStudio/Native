# Asteroid Forge + native kill haptics — 2026-09-10

## Delivered

- Eighth mission, with a scheduled mid-level asteroid belt and continuous boss-stage hazards.
- Three generated rock silhouettes, 32–108 logical px, 18–210 HP based on size; hard cap 28.
- Both sides' projectiles collide with rocks using earliest swept contact. Purple laser and bombs also destroy rocks. Player contact deals 100 HP with existing respawn invulnerability.
- 3,400-HP mining ship, spread cannon and four articulated mechanical arms. Real scene rocks are reserved, reached, pulled back, telegraphed, then thrown toward a locked aim point. Rocks remain destructible throughout. Cadence speeds from 2.5 seconds toward 0.65 seconds as hull HP falls.
- Existing boss bomb resistance (70%) preserved. Pause, retry, home, death/level transition cleanup covered.
- UIKit impact bridge injected into the game: light elite victory, heavy boss encounter victory. Twin down does not trigger victory. 250 ms rate limiting, lifecycle suspension/disposal, no delayed callbacks.
- zh/en/ja mission/Boss labels and glyphs. New copper-dust parallax background participates in the 9-second theme fade.

## Verification

- Games typecheck passed; 38 focused Sky Strike tests passed. Sky Strike browser production build passed (`GAME_FILTER=sky-strike npm run build`).
- Full Games `npm test`: 488 tests, 466 passed, 20 skipped, 2 failures in untouched MUGEN HYMUGEN golden hash and viewer virtual-list slot expectations. These pre-existing unrelated failures were not changed by this task.
- Native typecheck passed; all 8 Native tests passed (including mocked UIKit feedback lifecycle/rate/style checks).
- 18 real Chrome WebGPU cases passed. See `browser.log` and named JSON/screenshots.
- 72-second actual game-update simulation traversed the level schedule, reached Ore Reaper, observed 10 throws, and stayed within 28 rocks. The separate low-health rule test verifies increased grab frequency.
- Browser integration exercises both bullet factions, first-hit ordering, high-speed collision, laser/bomb damage, exactly one lost life on 100-HP contact, lethal bullet array cleanup, pause/home cleanup, and once-per-encounter haptics.
- Reviewed windup/throw, narrow/wide, asteroid-belt and all three language menu screenshots. No visual goldens were replaced.
- Final iOS build, strict codesign verification, install and launch passed. Source/runtime file hashes are in `build.json`.
- Actual iPhone Metal startup loaded 51 images and all 8 levels. Archived `device-host.jsonl` reaches 1,680 frames with zero error events and active haptics. Native frame 120 readback is included. This capture is the user's retained seventh-mission menu selection, not a claim of native eighth-mission combat acceptance.
- User confirmed eighth-mission playability and kill haptics (reply: “可以”). Follow-up native journal reaches 25,320 frames, 4 haptic API requests and zero errors. The user then requested player damage/death/bomb feedback.
- Follow-up adds light accepted-damage, heavy life-loss and medium successful-bomb feedback. Focused Games and Native tests re-passed; additional browser checks cover invulnerability and failed bomb suppression. Full-repository results above precede this small feedback extension; unrelated modules were not re-run. Final package hashes and installation are recorded in `feedback-build.json`.

## Assets / resource cost

Built-in imagegen prompts and original output paths are in `Games/games/sky-strike/assets/mining-art.md` (studio-relative). Master PNGs are retained there; only the offline RGBA pack ships on iOS. Runtime limits: boss 512px, three rocks 192px, background 512px.

Pack: 27,764,224 bytes (26.48 MiB, below the 28 MiB budget), +2,539,520 bytes from the previous version. Measured battlefield atlas: 33,808,448 bytes across three pages. No per-frame texture uploads. This is sprite atlas memory, excluding GUI/fonts, render targets and driver overhead.

## Follow-up: fighter pre-fire turn

- Seven ordinary fighters now have a 420 ms aiming lead, capped shortest-arc rotation, aligned muzzle/projectile direction, a 160 ms firing-pose hold and smooth return to cruise. Shots wait for alignment instead of snapping; cooldown resets prevent catch-up bursts. Flight paths are unchanged.
- 41 focused Games tests passed; Games and Native typechecks and all 8 Native tests passed. Browser fixtures verify turning, the actual projectile origin/velocity, pose hold, pause, return to cruise and late alignment. Narrow-screen screenshots reviewed.
- User confirmation above applies to the original mining/kill-haptic build. Subsequent damage/death/bomb haptics and fighter aiming are tested in code/browser; physical feel of those follow-ups remains unconfirmed.

Final combined fighter/feedback browser build, iOS build, strict codesign verification, installation and launch all passed. No commits were created.
Final combined package journal: 120 frames, 0 error events. See `aim-device-host.jsonl`.
