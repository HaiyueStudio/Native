# Seven-theme parallax space backgrounds

Seven generated nebula/star textures and two independent transparent planet layers now render behind combat on the existing Engine WebGPU canvas. Far field travels at 7 logical px/s, diffuse dust at 19 px/s, planets at 11 px/s, with faster foreground particles and depth-dependent horizontal motion.

Level completion starts a 9-second alpha crossfade, preserving travel and brightness. Interrupted transitions retain their current mixture. A new sortie immediately selects its mission theme. Pause freezes the new layer clock. Texture edge continuity uses alternate vertical mirroring through the public IndexedSpriteRenderer flipY flag; planets recycle only while fully off-screen.

Validation:
- 32 Sky Strike Node tests passed, including theme mapping, thousands of wrap-boundary samples, crossfade normalization/interruption/reset, layer speeds/depth and texture budgets.
- Games and Native typecheck passed; 7 Native tests passed.
- 13 real WebGPU visual cases: all seven themes, fade midpoint/end, wrap before/after, wide and narrow viewports. Screenshots reviewed for image seams, readability and composition.
- 4 regression cases passed: twins/bubbles, Boss balance, returning home/restarting and narrow-screen input.
- Pixel difference across a 2 ms mirrored-wrap boundary: mean absolute RGB difference 0.085/255, including live foreground stars.
- 46 static sprites, 25,224,704 runtime pack bytes, 31,129,152 battlefield atlas bytes. No per-frame texture uploads. Background tiles 512px; planet layers 384px. Raw masters are excluded from the native app bundle.
- Native build, strict code-sign verification and device installation passed. Packaged sprite bytes match source hash.

Master art and exact built-in imagegen prompts: Games/games/sky-strike/assets/space-art.md (studio-relative path).

Device: fresh frame 120 captured and reviewed; 9,600 frames observed without error/failure journal events. Device remained in the menu during captured samples, so native combat feel is not claimed as user-accepted.

Full repository tests: 437 passed, 12 failed, 7 cancelled and 20 skipped (476 total). Failures include the pre-existing MUGEN/UI evidence checks plus concurrently added rubiks-cube lobby-thumbnail/save-facade checks; cancellations are MUGEN timeout-related. Full build stopped at an unrelated minecraft-lite 180-second timeout. Sky Strike is built separately below. No unrelated game files were edited.

Final standalone Sky Strike browser build passed (300-second limit, no other games included).
