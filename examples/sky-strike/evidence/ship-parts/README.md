# Hull parts and quantum health update — 2026-09-11

Quantum dreadnought HP 4200 → 3570. Fourteen generated alpha sprites give each boss/elite distinct machinery, and replace procedural serpent circles/lines with armor, hydraulic links and aimable dorsal guns. Animation remains simulation-time driven and uses static GPU textures. Runtime RGBA pack: 29,235,456 bytes (27.88 MiB), below the unchanged 28 MiB budget; previous pack 29,140,480 bytes. Retired generic turret/rotor/hatch are excluded; source PNGs retained. Full prompts and SHA-256 provenance are in Games/games/sky-strike/assets/masters/ship-parts/.

Validation:
- Games and native TypeScript checks pass.
- 75 Sky Strike tests pass; 9 native host tests pass.
- Full Games suite: 544 tests, 522 pass, 20 skipped, 2 existing unrelated MUGEN failures (byte-exact HYMUGEN fixture; viewer DOM slot contract).
- Targeted web build and signed iOS device build pass; codesign deep/strict verification passes.
- Real Chrome/WebGPU fixtures: serpent, elites, bosses-a, bosses-b and quantum-core-calm pass. Screenshots reviewed. New parts report zero texture uploads per frame. Initial serpent fixture theme typo corrected; one Chrome startup timeout retried successfully.
- Updated app installed on connected iPhone. Native screenshot and journal verify serpent rendering with the new assets. Diagnostic was interrupted by application suspension after several seconds; no complete thirteen-hull native report was produced. The journal shows suspend/resume rather than a render error. Native screenshot is not a full animation/performance acceptance.
- Normal launch restores the persistent save backend; diagnostic mode uses MemorySaveBackend and does not overwrite player progress.

sources.json binds the source/runtime hashes. This folder is local diagnostic evidence, not a formal performance benchmark.
