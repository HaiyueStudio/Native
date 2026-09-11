# Serpent charge and red wing hardpoints — 2026-09-11

Destroying the final body segment now resets the surviving head’s initial charge cooldown and bypasses its former 35% HP gate. Bare-head returns use 320 units/s and a 900 ms post-entry cooldown (previously 110 units/s and 4200 ms). Charged flight speed/contact damage remain unchanged. Normal body-bearing behavior remains intact.

Red weapon mounts use y=-24+40*abs(normalized side), so outer mounts are at y=16 on the wings, while the nose remains at -24. Pods, flashes and projectile origins share the same deterministic helper. Horizontal spread, rate, damage and other weapon forms are preserved. No new textures.

Validation: 88 Sky Strike tests, Games typecheck, targeted web build, Native typecheck and 9 Native tests passed. Device build and strict signing verification passed. Two registered Chrome/WebGPU fixtures passed; screenshots reviewed. Serpent scenario uses real distributed damage (1071 then 9) to destroy all nine segments while head HP remains above 35%, observes immediate charge, three starts within 9 seconds and pause freeze. Red scenario verifies all seven actual projectile/flash origins and static uploads. Diagnostic evidence, not a performance benchmark.

Device update installed and launched successfully; fresh host rendering snapshot is in startup.json. Repository-wide bounded npm test: 534 passed, 2 unrelated MUGEN/asset-viewer failures, 1 cancelled suite after 120 seconds.
