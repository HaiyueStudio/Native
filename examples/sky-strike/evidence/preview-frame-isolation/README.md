# Preview switch pending-frame isolation

Root cause: GUI input may run after the battle render pass is encoded but before its command buffer is submitted. guiComposition reused the battle IndexedSpriteRenderer, whose render call writes shared instance and viewport GPU buffers. The pending battle draw therefore read portrait-sized coordinates and a different sprite layout for one frame.

Fix: compose each uncached portrait through its own short-lived IndexedSpriteRenderer with only the required sprite sources and exactly enough draw-command capacity. Submit before disposing temporary renderer/MSAA resources; retain the small cached output texture. Cached switches create no new renderer. No main-renderer buffer or state writes occur during composition.

Red/green reproduction: the registered preview-switch-frames browser fixture encodes a real main-renderer pass, switches levels before queue submission, and compares GPU readback bytes to an otherwise identical control pass. Before the fix, entering mission 2 changed 97,210 bytes. After the fix, all 24 transitions (first visits plus cached cycle) have zero changed bytes. Preview rectangles are also checked immediately after each switch. This catches the transient corruption that settled screenshots missed.

Other validation: 92 Sky Strike tests, full Games typecheck and scoped fixture typecheck passed. Serpent, mining and Inferno previews passed additional browser checks.

Device build/signature verification and installation succeeded. App launch and fresh native host log confirm ready rendering. Web build passed on its own using the supported 120-second build-timeout setting after the concurrent 60-second attempt timed out. Full repository tests retain unrelated MUGEN failures and pending tests and were stopped at 120 seconds; no unrelated game files were modified.
