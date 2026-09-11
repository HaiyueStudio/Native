# Quantum battleship articulated update

The central decorative rotor is removed. Six shared 128px turret sprites track the player independently, and projectiles/muzzle flashes originate at their rotated tips. The core breathes yellow every 2.2s; strictly below 35% HP it turns red with a 0.42s cycle. The body sweeps through both horizontal halves in 12.57s, with reach tied to visible width; the quantum echo mirrors the sweep and rotation. Fire cadence remains 875ms.

## Validation

- 71 Sky Strike focused tests passed, including all declared asset paths, real alpha, the 28MiB sprite budget, barrel-tip geometry, reactor threshold and broad viewport motion.
- Nine Chrome WebGPU scenes passed and were visually reviewed: left/right sweep, narrow sweep, normal/dim/critical core, natural full mission completion, narrow combat and carousel.
- Games/Native typechecks and the filtered web build passed. Native host tests: 9 passed. Device build and strict code-sign verification passed.
- The preceding full Games suite found the then-missing turret asset (now fixed and covered by focused tests), two unrelated existing MUGEN assertion failures, and a Petra import timeout. The isolated Petra import recheck passed. Full-suite success is not claimed.
- Native installation and diagnostic launch succeeded. 61 native samples confirm all six turret angles, yellow/red core states, horizontal body travel from x=100.29 to x=380.81, zero per-frame texture uploads, and complete pair/laser cleanup after Boss death. The captured native frame was visually reviewed. The probe used memory-only saves and the app was then relaunched normally.

The browser JSON files carry runner/adapter identity and validation details. Source and built-bundle hashes are in source-fingerprints.json; this is a dirty-workspace diagnostic, not a formal release baseline. Prior quantum-horizontal evidence describes the older movement and artwork and is superseded for this update.

Artwork prompts and transparent-layer preparation are documented in Games/games/sky-strike/assets/quantum-turrets-art.md. The generated masters and alpha-preparation hashes are preserved under assets/masters/quantum-turrets. Runtime sprites total 29,140,480 bytes (27.79MiB).
