# Dreadnought hull-matched parts — 2026-09-11

The built-in image_gen generated a black iron/bronze/crimson heavy cannon and dedicated turbine rotor. Exact prompts and art provenance are under Games/games/sky-strike/assets/masters/dreadnought and masters/ship-parts/provenance.json. Source alpha is unchanged. Runtime gun/rotor limits are 128px/96px; total pack is 29,108,480 bytes, increasing 36,864 bytes. The two turbine instances share one texture and rotate oppositely in the existing red reactor sockets. Existing aiming/recoil and flame-elite entry fix are retained.

Browser: registered dreadnought fixture passed in real Chrome/WebGPU; capture reviewed for socket alignment, palette and transparent edges. Games typecheck, 86 focused tests and targeted web build passed. Repository-wide tests and device build results appended below when complete. Diagnostic evidence only; no performance benchmark claim.

Device package: iOS build succeeded, strict code-signature verification passed, and packaged sprites.rgba SHA-256 matches the Games source pack. Installation is pending because the paired iPhone reports disconnected. No on-device execution claimed.

Repository-wide npm test did not complete successfully in the 120-second bounded run; unrelated MUGEN/asset-viewer failures and cancellations remain. The 86 focused Sky Strike tests all passed, including fifteen-part inventory, alpha, dimensions and the unchanged 28 MiB pack budget.

Update 2026-09-11: latest signed app installed successfully via devicectl and launched normally. Fresh host log confirms ongoing present events; installed-startup.json records the startup snapshot. This supersedes the pending-installation note above. Dedicated cinder native probe has not been run in this update.
