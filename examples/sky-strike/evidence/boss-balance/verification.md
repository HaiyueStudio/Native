# Boss balance and lighter HUD — 2026-09-10

- Boss bomb damage: 30% of prior damage; Helios proxy damage follows the same reduction, while ordinary enemies retain full damage.
- Iron Serpent: each hit is shared among living sections with overkill redistributed. Boss HP receives that hit once; a bomb covering all nine parts still deals only 126 boss damage. Head remains damageable after all body parts die.
- Helios: after each active laser ends, teleport to a different free slot, avoiding the player. Warning/beam positions stay fixed; the next attack has a fresh cooldown.
- Carrier: 3-second deployments, one random elite per third successful deployment, capped at two living elites. A blocked summon is skipped without a backlog; defeated elites can be replaced on a later third deployment. Bay animation uses the same interval.
- HUD background alpha: 0.76 → 0.40. Narrow Japanese / low-health screenshots reviewed.

Validation: Games and Native typecheck passed; 27 Sky Strike Node tests, 7 Native tests, and 6 real WebGPU browser cases passed. All 23 Games targets built. Native build, strict code-sign validation and device install passed. Full repository tests: 429 passed, 10 failed, 20 skipped (459 total); failures remain in pre-existing MUGEN/UI evidence and fixture checks. No test golden was changed.

Build process exit codes and source/package hashes are recorded in build.json. Browser balance assertions exercise the real game simulation, not a duplicate implementation.

Device launch: fresh frame 120 captured and visually reviewed; 155 frames observed, no journal error/failure events. App then suspended normally; real-device combat feel remains for user playtesting.
