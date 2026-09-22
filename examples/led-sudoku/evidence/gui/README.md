# Haiyue GUI migration verification — 2026-09-22

The browser, Android and iOS now share `Games/games/led-sudoku/engine-gui.ts` and the pure `gui-controller.ts`. The previous DOM HUD and NativeScript game controls were removed. Native bootstrap/splash, Canvas, storage and lifecycle adapters remain platform-specific; the board and seven-segment rasterizers upload textures to GuiImage.

## Checks

- Scoped Sudoku suite: 315/315, including 7 GUI controller/layout/save tests.
- Native Sudoku suite: 14/14; Native typecheck passed.
- Single-game Web build, Android Debug build and signed iPhone device build succeeded. No Engine source changed; no repository-wide checks were run.
- Android and iPhone final `final-host.jsonl` both record `gui-complete`, 31 checks passed. Button tests dispatch down/up through the Native pointer target and GuiSystem hit testing. Select/switch tests use public GuiSelect/GuiSwitch setters. Covered settings, English/Japanese, skin, press/release help, Worker generation, staircase saves, explanation pages, applying candidate eliminations, save/reload/undo and answer confirmation/undo.
- Browser verified at 1280×720 and 390×844 with actual Canvas clicks: settings dropdown, light skin, selecting board cells, new puzzle/difficulty, visible unique-solution progress and return to play. No console errors/warnings; screenshot in Games `evidence/gui/phone-light.png`.
- iPhone screenshots `dark`, `light`, `settings`, `help`, `new` were reviewed after the final installation. Measured content is 430×839 DIP within a 430×873 native drawing surface; controls use the safe content measurement. English wraps by font-atlas advances without clipping.
- Android normal screenshot reviewed at 1080×2400, 360×733 DIP content. System-touch screenshot transfer was interrupted by USB disconnects; incomplete PNGs were removed. The 31 in-app pointer/hit-test checks are the authoritative interaction evidence; a separate OS-touch screenshot assertion is not claimed.

## Save isolation / restoration

GUI diagnostics use the `led-gui-smoke` namespace and never overwrite the `haiyue-games` player save or preferences. After testing, both devices were launched without smoke flags. Normal logs record Android seed 3267646049 at 25/81, iPhone seed 3292813623 at 81/81. iPhone capture-only mode was also exited with a normal launch.

Undo records now persist up to 200 steps, including crossed candidates and verified deduction progress; legacy saves with no undo history still load. Old sessions cannot recover history that the previous version never saved.
