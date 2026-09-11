# Cinder Guard natural-entry regression — 2026-09-11

Root cause: the Cinder Guard uses the sweep flight path, whose generic movement branch never set EnemyState.entered. SkyStrikeFlames correctly requires entered before starting attacks, so the elite never telegraphed or sprayed in ordinary play. Previous fixtures injected entered=true and masked the bug.

Fix: the ordinary moving path marks an enemy entered when its center crosses y=40, matching the existing ordinary attack entry threshold. Boss and anchored entrance behavior is unchanged.

Regression fixture runs the actual mission-11 timeline from time zero with no manually spawned elite or forced entered flag. It observes offscreen suppression, entry, warning and active spray, checks one contact tick (3 health), pause freeze and removal on death, and captures the natural encounter again. The real Chrome/WebGPU fixture passes and its screenshot was reviewed. 86 focused Sky Strike tests and typecheck pass. Native diagnostic mode SKY_CINDER_PROBE likewise uses the unmodified level timeline and an isolated memory save.

Source fingerprints and browser evidence accompany this note. This is local diagnostic evidence, not a performance benchmark.

Validation completion: the targeted web build, Native typecheck/test suite, signed iOS device build and strict code-signature verification passed. The bounded repository-wide Games test run was not green: 512 passed, 2 failed and 6 cancelled; failures are in MUGEN/asset-viewer fixtures, with additional suites stopped at the 120-second limit. Focused Sky Strike tests remain 86/86 passing.

iPhone installation and the natural-timeline native probe remain pending: the paired device reported disconnected on the final connection check. No new native execution result is claimed.

Update 2026-09-11: latest signed app installed successfully via devicectl and launched normally. Fresh host log confirms ongoing present events; installed-startup.json records the startup snapshot. This supersedes the pending-installation note above. Dedicated cinder native probe has not been run in this update.
