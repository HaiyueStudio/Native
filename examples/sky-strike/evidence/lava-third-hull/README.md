# Third hull restored, lava animation — 2026-09-13

Restores the user-selected third square hull; image_gen removed its painted checkerboard to real alpha. Source and render aspect are both 1:1. Twin pivots now use normalized x ±0.165 and y +0.028 with the declared render aspect, matching the sockets in this source. Central window has a masked domain-warped lava shader with flowing bright veins and a slow pulse, leaving metal frame visible. Gun runtime resolution reduced to 192px to keep the complete pack below 28 MiB (29,255,936 bytes).

Validation: 90 focused Games tests, Games typecheck/targeted web build, 9 Native tests and Native typecheck pass. Chrome/WebGPU early-jet and wide-jet fixtures pass with reviewed screenshots. Signed iOS build passes and installation succeeds; phone runtime result recorded separately. New source-aspect regression prevents the prior distorted hull replacement. Full-repository test result appended below. No performance benchmark claim.

Native probe completed 18,005.085 ms and 17 samples, up to 49 shader instances, zero frame texture uploads. Full result is phone-probe.json. Normal launch restored after the test. Repository-wide bounded npm test retains unrelated MUGEN/asset-viewer failures and a timed-out suite: ℹ tests 568, ℹ pass 545, ℹ fail 2, ℹ cancelled 1.
