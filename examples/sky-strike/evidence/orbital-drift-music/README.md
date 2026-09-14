# Orbital Drift gameplay music

- Original 40-second, 96 BPM / 16-bar D minor synth score; generated PCM metadata and hash: `music.json`.
- Games typecheck and 94 Sky Strike tests passed. Native typecheck and all 9 example tests passed.
- Registered real-browser `audio` fixture passed: 20 decoded buffers, gameplay effects, protected music/laser voices within the 12-voice budget, mute, background/resume, pause/home/new sortie and game-over behavior.
- Targeted Web build passed. Native device build and signature verification passed. Installation on the connected iPhone succeeded. `package.json` binds the exact bundle and verifies the packaged music matches its source.
- After user unlock, the on-device 42-second probe completed successfully: one protected music voice, one schedule call, 20 decoded buffers, no audio errors. Pause cleared all voices and stopped the engine. `device-music-probe.json` retains 5-second snapshots and final state. The initial locked launch is retained separately.
- Full Games suite ran for 120 seconds; unrelated MUGEN byte-exact/viewer/compatibility failures and unresolved test workers remain. No thresholds were changed and no unrelated game code was modified for these failures.

The score uses circular note tails and delays; WAV has no silent padding. Music and SFX share the existing saved Sound/volume controls. The music channel stops outside active gameplay and restarts at the beginning when gameplay resumes. Offline synthesis adds no per-frame synthesis work.
