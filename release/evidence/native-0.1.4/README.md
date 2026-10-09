# Native 0.1.4 release acceptance — 2026-10-09

This release contains system sharing, optional Engine integration and iOS ATT handling. It publishes reusable Native adapters; game examples remain in GitHub source only.

## Release status

Source and independent clean-export gates passed. npm authentication required renewal (HTTP 401); publication status is recorded separately in `publication.json`. This source snapshot does not itself claim that registry publication has completed.

## Source and package gates

- 789 frozen inputs; both gates verified the same manifest SHA-256.
- [Working-directory source gate](source-gate.json): 27 stages passed.
- [Independent clean-export gate](clean-source-gate.json): 35 stages passed, including lockfile installs for root, npm package and all six examples. This is a new export with no copied node_modules or build products; it reuses installed system tools and npm download cache, not a new operating system.
- Each gate passed 193 tests: 103 repository/service, 6 real-tarball/package and 84 across the six examples. All corresponding type checks passed.
- Private candidate contains 110 files, 234,138 compressed bytes; no games, examples, models, Engine vendor archive, signing material or test evidence is included. The formal tarball is checked separately after creating the source tag.
- Recorded console logs are normalized to LF with trailing whitespace removed; event content and failed-attempt outcomes are preserved.

## Device evidence and remaining coverage

- [System sharing](../../../bridge/share/evidence/device-content-2026-10-08.json): iPhone 15 Plus and Android X4000; image/text sheet, cancellation/reopen, rotation and background recovery. External recipient delivery was not tested. Engine-generated cards used the then-local Engine 0.2.1 candidate.
- [ATT real-device results](../att-2026-10-09/summary.json): native first prompt refusal, Settings enable/revoke, repeat startup, paid/legacy/age policies, regional refusal and test-ad callbacks.
- [Restricted automated coverage](../att-2026-10-09/restricted-automated/summary.json): actual Swift bridge logic compiled with SDK doubles, plus TypeScript gateway regressions. **自动化通过，真机待验收。** Temporary Screen Time settings were restored; the attempt returned denied, not restricted.
- [Engine compatibility](../engine-compatibility-2026-10-09/summary.json): optional peer `^0.2.0`, actual published Engine 0.2.0 consumer tests and independent system-only installation without Engine. Public 0.2.0 rendering compatibility does not imply it contains the later share-content extension.

Existing evidence applies to the builds and source hashes recorded there. This release does not claim a new six-game device run, store submission, purchase sandbox acceptance, real ad revenue or full Apple restricted-state device acceptance. Monetization remains experimental.
