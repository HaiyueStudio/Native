# Calendar puzzle audio and revised rotation icon (2026-09-19)

Eight original MIDI-derived PCM sound effects use the Engine mixer on Web and the shared AVAudioEngine PCM bank on iPhone. Native webpack copies the canonical WAVs directly from Games, avoiding duplicated asset sources. Playback is gesture initiated, debounced, and stopped on suspension/interruption/disposal. The rotation icon uses a filled counterclockwise arrowhead tangent to a balanced circular stroke.

Validation:
- Web and native TypeScript checks passed.
- Audio policy and WAV integrity tests: 3 passed (debounce, delayed unlock/stale cue cancellation, all eight PCM formats, bounded peaks and zero edges).
- Native unit tests: 5 passed.
- Targeted Web bundle and signed iPhone build passed. Installed in place with the existing bundle identifier.
- iPhone smoke: 23/23 passed. All eight buffers decoded; each of the eight gameplay cues reached AVAudioEngine playback, with no backend errors or pending/looping voices at completion. See audio-status.json.
- New arrow screenshot visually reviewed.
- Normal launch restored the user's September 24, 2026 puzzle. No audio cue played automatically on startup.
- Full Games suite: 661 tests, 639 passed, 20 skipped, same 2 unrelated existing failures (HYMUGEN canonical packing and viewer-product assertion).
