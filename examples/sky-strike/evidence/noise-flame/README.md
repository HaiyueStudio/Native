# Advected noise flame — 2026-09-13

Implements four-octave domain-warped WGSL fire, carried fixed-step travel, overlapping radial bands with feathered seams, no sector warning, cylinder-UV scrolling on the elite sleeve, and independently aimed Boss guns whose muzzle transforms are also emission origins. Prior elapsed burn and ignition rules remain in place. Art prompts and provenance: Games/games/sky-strike/assets/masters/noise-flame/.

Verification: Games typecheck and 89 focused tests passed; 9 Native tests and Native typecheck passed. Targeted web build passed. Actual Chrome/WebGPU natural elite and boss narrow/wide fixtures passed; final natural/wide fixtures explicitly assert the custom shader pipeline. Reviewed screenshots show continuous noise tongues after correcting initial band seams. No frame texture uploads. Packed image bytes: 29,174,016 (<28 MiB). Runtime shader buffers are bounded. This is diagnostic evidence, not a benchmark.

Repository-wide npm test: 542 passed, 2 unrelated MUGEN/asset-viewer failures, 1 cancelled suite at the 120-second bound.

iOS build targeting the physical device failed because it was unavailable. Final generic iOS offline build and strict code-signature verification passed. Built bundle contains the final feathered-band shader and packed textures match source. Installation attempt failed with CoreDevice error 1011 (device not found); on-device shader/runtime validation remains pending. No claim of installation or native rendering success.

Update 2026-09-13: installation succeeded after USB connection. The isolated memory-save fire probe completed 18,007.918 ms, recording 17 samples with the native advected-fbm-flame pipeline and up to 46 instances; frame texture uploads remained zero. Full result is phone-probe.json. This supersedes the pending-installation/native-validation note above.
