# Synthesized audio — 2026-09-10

Implemented 13 deterministic synthesized effects, shared playback policy and persisted Chinese/English/Japanese Engine GUI sound settings. Browser uses the public Engine mixer; iOS uses the new PCM bank bridge and 12 native player nodes.

Validation completed:
- Games and native TypeScript checks passed.
- Audio/localization focused tests: 10 passed. Native example tests: 9 passed.
- Real Chrome WebGPU: audio scheduling/game firing/laser lifecycle/concurrency/background and rapid resume/mute/disposal; Chinese, English and Japanese settings; narrow 280×900 Japanese settings; pause UI. All six scenes passed. Settings fixtures also exercised mute, volume down/up and persisted values. Screenshots inspected for layout and legibility.
- Browser Sky Strike target build passed.
- Native device build and strict deep signature verification passed. Every bundled WAV matches its Games source; hashes and byte counts are in bundle-verification.json.
- Full Games suite: 509 tests, 487 passed, 20 skipped, 2 failed. Existing unrelated failures are HYMUGEN byte-exact golden validation and the viewer's UI slot assertion; neither is changed by this work.

Device installation and real-device audio scheduling/listening are PENDING: iPhone was paired but disconnected at both checks. The user has been asked to connect/unlock. No claim of native audio acceptance is made.

preview.wav demonstrates the original synthesized PCM at the default volume, with silence between effects; order/timing is in preview-timeline.json. Laser loops run for four periods. It is not a device recording. Sound quality/loudness balance still requires human listening.

After connection, install the signed examples/sky-strike/platforms/ios/build/Debug-iphoneos/skystrike.app, launch once with SKY_AUDIO_PROBE=1 to validate all effects (about 26 seconds), retrieve Documents/sky-strike-audio-probe.json and the host journal. Then relaunch normally and test actual shooting, bombs, explosions, laser release, pause/background and settings persistence. Native audio respects the iPhone silent switch.
