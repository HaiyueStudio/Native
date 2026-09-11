# Quantum fleet horizontal formation

Quantum echoes now share their real owner's height and enter the scene from above. Position mirrors only across the visible viewport's vertical centerline (`x' = 2cx - x`, `y' = y`); rotation is `-rotation`. Gun hardpoints, turret direction, bullet velocity (`vx' = -vx`, `vy' = vy`) and laser endpoints use the same horizontal reflection. The quantum battleship stays in the right upper lane while the real hull occupies the left; their horizontal center separation is at least 180 logical pixels even under the tracked narrow-screen camera.

The dreadnought's base bullet interval changes from 700 to 875 ms, reducing fire frequency 20% for both the body and echo. At mission 12's existing interval multiplier this is 1097.6 → 1372 ms. Laser timing and weapon damage remain as before.

Games typecheck, production Sky Strike build and all 67 focused Sky Strike tests pass. Five real Chrome WebGPU cases pass: horizontal battle, fleet, active lasers, narrow Japanese viewport and the full natural mission-to-victory simulation. Screenshots have been visually reviewed. Coverage includes identical-height entry, reflection geometry/muzzles/projectiles, finite cadence, ghost immunity, damage, lifecycle and zero per-frame texture upload.

This is dirty-workspace diagnostic evidence, not a formal release/performance gate. Browser JSON files include runner and actual asset provenance. Native evidence and the built bundle fingerprint are recorded alongside these files after installation.

Native build, strict signature verification and installation pass. A 61-sample on-device probe confirms that every body/echo pair has identical Y and opposite rotation, all hostile laser paths point downward, and forced boss death cleans all echoes. The screenshot is visually reviewed. The launch-only probe uses memory saves; normal play is restored afterward.

Full repository test run: 537 tests, 515 pass, 20 skip, 2 existing unrelated MUGEN failures (byte-exact golden and viewer virtual-list slot assertion), no cancellations.
