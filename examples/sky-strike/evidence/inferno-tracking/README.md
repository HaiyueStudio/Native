# Inferno tracking and pursuit update — 2026-09-11

- Active narrow Boss fire tracks the player at at most 0.16 rad/s (9.17 degrees/s), within its existing ±0.55-radian aiming range. Wide fire and warning direction remain fixed. Rendering and collision share the same cone angle.
- Live ignited enemies replace their normal flight path with pursuit at 60 logical pixels/s, without overshoot. The original three-second fuse is unchanged. Shot-down pursuers leave stationary burning wrecks at their death position.
- Inferno Ark uses ordinary three-round red spread salvos. Base fire interval 900 ms; existing wave scaling makes it 1443.6 ms in mission 11. Damage uses the existing ordinary red enemy bullet profile.

Validation: 86 Sky Strike tests pass, Games and native typechecks pass, nine native tests pass. Web build, iOS device build and deep/strict signature verification pass. Three Chrome/WebGPU fixtures (long, wide, wreck) pass; gameplay assertions cover ordinary salvo, bounded active tracking, movement override, stationary wreck, fuse retention, burns, escort cap and pause/home cleanup. Screenshots visually reviewed. No asset changes or additional per-frame texture uploads.

Full repository test attempt was bounded to 120 seconds after the prior repeated Petra timeouts: 551 reported tests, 528 pass, two existing unrelated MUGEN assertions fail, one Petra file cancelled, twenty skipped. The owned test process group was stopped at the deadline. This is not a fully green repository suite. Two initial browser runs stopped at the existing carousel next-button readiness assertion; retry passed. Failure now includes frame/display/layout diagnostics.

Updated signed app installed on the connected iPhone. Native probe uses MemorySaveBackend and does not overwrite player progress. Source fingerprints are in sources.json. This is diagnostic evidence, not a formal performance benchmark.

Native validation completed: 18.003 seconds, 17 snapshots; both 330/570-range cone modes observed, narrow angle changed gradually, up to 19 bullets and four armed fighters present. Zero per-frame texture uploads in every sample. Capture reviewed. Normal persistent-save launch restored after the probe.
