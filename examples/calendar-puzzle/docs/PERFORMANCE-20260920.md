# Calendar Puzzle performance changes — 2026-09-20

## Changes

1. Native text rasterization now shares one scratch Canvas, with transform reset and pixel clearing before every draw. Textures still upload to their stable individual GPU keys. The web path keeps independent Canvas identities because browser materials may retain a source rather than copy it immediately. Scratch references are released on disposal.
2. The hint overlay keeps its own scratch surface and remembers its last piece texture. Repeating a hint for the same piece avoids both rasterization and GPU upload. A different piece redraws before reuse, and hiding a hint preserves only this single bounded cache.
3. Selection color pulsing no longer rebuilds oriented cell arrays or reassigns each tile's position/scale every frame. Actual movement, selection changes and animation still update transforms.
4. Calendar native normal launches use `diagnosticIntervalFrames: 0`: startup, lifecycle and errors remain logged, but the 120-frame full state snapshot + synchronous journal rewrite no longer runs continuously. `CALENDAR_SMOKE=1` or `CALENDAR_PERFORMANCE=1` retain periodic diagnostics for testing/profiling. The shared host keeps its existing default for other apps.
5. Native texture snapshots now expose created Canvas and upload counts, in addition to retained GPU texture count/bytes, so stress runs can distinguish lifetime work from retained memory.

The previous CPU Canvas fix (`willReadFrequently: true`) remains in place on both platforms. Main gameplay rendering still uses Metal / Vulkan. This change does not lower MSAA, display resolution or animation frame rate.

## Targeted evidence

- A stress unit test executes 1,000 native copied text updates, alternating sizes: one Canvas allocation; every draw starts with an identity transform and full clear. Disposal releases the reference. Web test confirms a second label cannot mutate the first label's source.
- Shared-host test simulates 600 presentations: normal mode takes one initial snapshot and writes two records including host creation, while diagnostic interval 120 takes six snapshots and seven records. This only measures the tested host events; real startup/lifecycle have additional records.
- Native splash test checks first-presentation gating, duplicate presentation, error during fade, normal removal and disposal. No enforced startup hold or recurring animation timer.
- Game-focused tests and Native tests are stored in `../evidence/20260920-release-prep/` along with build/typecheck/device evidence as available.

These are resource/work reductions, not measured percentages of battery life or GPU frame time. Temperature and power conclusions require matched-device, matched-brightness, matched-workload runs. Do not infer an FPS increase from fewer Canvas allocations.

## Next optimization candidates

- Idle board rendering: the game still renders continuously. A proper event-driven/idle frame policy would reduce GPU work more than text caching, but must wake for touch, pulse, hints, animations, resize and resume. Measure first and coordinate with engine scheduling rather than skipping frames in an ad hoc timer.
- Solver: the bounded reusable worker already keeps heavy work off the main thread. A bounded cache for solved dates could reduce repeat work, but must validate all fixed placements and invalidate stale requests. No solver-rule change was made in this pass.
- Release footprint: debug APK was ~193.3 MiB; inspect per-device Release AAB downloads before deciding whether engine/module splitting is worthwhile. Native libraries dominate more than this 127 KiB splash image.

## Verification result

Calendar-focused tests: 38/38; Native tests: 11/11; Games, app and shared bridge typechecks passed. iPhone 15 Plus completed all 89 isolated-save gameplay checks and continued to 4,080 presented frames without an error. This device run exercised the scratch surfaces, hint cache, selection transform change and splash dismissal. The later final package adds only diagnostic counters/capture and the refined image, and has also been built and installed; its screenshot check was initially blocked by device lock.

The repository-wide test run was not green: two pre-existing MUGEN assertions failed and nine Petra tests timed out. The initial run also exposed a Node strip-only test compatibility issue in the new raster helper; that was fixed, then all 38 calendar tests passed. See `games-full-summary.log`. No unrelated MUGEN implementation was changed.
