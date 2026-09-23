# Killer cage rendering — 2026-09-23

- Cage borders now trace complete inset contours, including concave turns and holes. Dashed strokes cross cell boundaries without the former 10-unit gaps and are drawn over grid lines.
- Killer notes reserve the top of the sum cell for its total. The small LED sits below it, beside a slightly tighter 3×3 candidate grid. Crossed notes and explanation eliminations use the same positions. The shared board painter also serves image export.
- 15 focused rendering, note-sync and preference tests passed. TypeScript checking and Sudoku-only web, Android and iOS builds passed. No Engine files changed or full-repository checks run.
- Browser seed 331 (`killer=1&led=1&difficulty=easy`) visually verified in dark and light-blue themes, including all nine manual candidates and a crossed candidate. No console warnings/errors.
- iPhone app updated and launched with the existing player save (seed 3426414039, 49 filled cells). `ios/board.png` shows continuous real-device cage borders. `ios-journal.jsonl` records a successful render. Returned to ordinary launch mode afterward.
- Updated Android APK built; no Android device was connected, so installation remains pending.
