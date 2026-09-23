# Rule page, statistics entry and thermometer alignment — 2026-09-23

- Removed both footer arrows from the rule description page. Its text now uses the shared inertial GuiScrollView, with the return button retained at the top right.
- Moved Completed puzzles / 通关记录 to the first full-width button beneath the Settings heading.
- Fixed thermometer stroke width shadowing the board column count. Both outline and interior now follow the same cell centers as the bulb, including row crossings and bends. This shared painter also fixes exported images.

Validation:

- 21 focused Sudoku tests passed: two thermometer regressions and 19 GUI/preferences tests. Regression geometry covers both themes, LED on/off, edge cells and turns.
- Native TypeScript check, Sudoku-only browser build, Android and iOS builds passed. No Engine files changed; no repository-wide test run was needed.
- Browser preview seed 321 with thermometer enabled was visually checked for joined bulb/tube geometry, the Settings entry, and arrow-free rule text. No warning/error console messages.
- Updated iPhone app passed 60 GUI checks (`ios-journal.jsonl`), then returned to normal launch mode. Screenshots show the new Settings entry, statistics page and rule page. Smoke testing isolates player saves and preferences.
- Android APK built successfully, but installation was unavailable because ADB reported no connected devices. Existing installed Android app was not changed.
