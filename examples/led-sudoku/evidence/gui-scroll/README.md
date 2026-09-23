# GUI scrolling and persistent help

2026-09-22. Shared Haiyue GuiScrollView / GuiHelpDialog integration.

- Android R1LM47Q11861CD and iPhone 15 Plus both passed 41 checks. Journals record each assertion and the final gui-complete event.
- Tap help: down alone does not open; up/click opens persistently. Blank dialog interior stays open. Close and backdrop both dismiss.
- Dragging from a rule switch scrolls without changing its value; the final rule is reachable and its help opens without pagination.
- Existing settings, localization, worker generation, explanation, hint exclusions, save/reload undo, and answer undo remain covered.
- Smoke uses separate led-gui-smoke storage. Normal app launch restores the player's original save and preferences.
- Screenshot review caught missing Chinese glyphs in the new instruction. The atlas now includes 详 and 细, and a test checks the new instruction in all three languages.

Engine validation and global gate limitations: Engine/review/gui-scroll-help/README.md.

The final smoke also sends down/up synchronously before a GUI frame to cover real fast taps. This caught and fixed native capture of an already-ended touch. Earlier journal entries can contain that pre-fix failure; use the last completed run for final verification.

Final installed builds: Android and iPhone each passed 41 checks, including the completed fast touch case. android-new.png and ios/new.png confirm the instruction renders 详细 correctly and question buttons have transparent circular outlines. Both devices were relaunched without smoke flags to restore normal saves.
