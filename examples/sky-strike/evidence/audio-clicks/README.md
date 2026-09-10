# Native audio installation and GUI click sound — 2026-09-10

The installed iPhone app was still the pre-audio build: its retrieved game snapshots had no audio state. The previous audio package had only been built, not installed. Updated the iPhone in place with the newly signed app, preserving career and locale data.

Added one original synthesized two-tone sci-fi GUI click (6,660 bytes). Clicks cover carousel arrows, options/locale/volume/back, launch, bomb, pause/resume and home. HUD confirmation is scheduled after the action so pausing does not cut it off. Menu sounds do not enable combat audio. Mute/zero volume/background/disposal cancel pending sounds, and a brief retry handles asynchronous browser unlocking. Total bank: 14 WAVs, 446,030 bytes; native float PCM: 890,828 bytes.

Verification:
- Games/native TypeScript checks passed; focused audio tests 5/5; Native tests 9/9.
- Real Chrome WebGPU audio, settings, home, pause and narrow gameplay passed, including GUI click counters and pause confirmation while combat is inactive.
- Browser Sky Strike build, iOS build, strict signature verification, installation and launch passed.
- On the actual iPhone, AVAudioEngine loaded 14 buffers and allocated 12 nodes with no error. Every probe sound had an active native voice; both laser loops scheduled successfully. Probe completion stopped all voices and paused the engine.
- Native logs also captured real user GUI/gameplay interaction: 44 GUI clicks and 170 successful native play calls at the saved snapshot, with no audio error. The user operated the game during the probe; this is not an isolated performance measurement.
- Full Games suite: 510 tests, 488 passed, 20 skipped, 2 existing unrelated failures (HYMUGEN golden bytes and viewer UI slot assertion).

User has been asked to confirm audible output and loudness. Successful native scheduling does not itself verify speaker output; the iPhone silent switch and system volume still apply. Probe results and sanitized snapshots are alongside this file.
