# Sudoku UI, completion statistics and image export — 2026-09-23

- Shared Haiyue GUI: capsule/circle switch geometry; 24 px outline rule-help button (previously 34 px); single bulb explanation action; export icon; Settings → Completed puzzles with a scrolling per-difficulty/per-rule ledger.
- Completion ledger deduplicates puzzle identities across replay, undo and app restart. Revealed solutions do not count. Every enabled rule is credited separately. Stored independently from the active puzzle; existing history cannot be reconstructed.
- Export uses the current board, notes and enabled rule descriptions with dynamic image height. No selection or lesson highlights. Dark/light themes and Chinese/English/Japanese use the same renderer. Browser downloads PNG; Native saves to the system photo library.

## Evidence

- `android-final-journal.jsonl`: 52 GUI checks passed, including statistics navigation, 24 px help and the replacement toolbar. Smoke runs have isolated save/statistics/preferences state.
- `ios-journal.jsonl`: 54 checks passed, including successful Photos completion after the user accepted add-only access.
- `exported-android.png`: actual 1380 × 1666 PNG read back from Android MediaStore (`Pictures/Haiyue`), visually inspected for complete board and rule text.
- `ios/new.png`, `ios/settings.png`: inspected actual iPhone GUI screenshots with round tracks/thumbs, small help buttons and statistics entry.
- Both updated apps were returned to normal launch mode, preserving player puzzle progress and preferences.
- Games focused GUI/controller/export tests: 11 passed; preference tests: 8 passed. Native session tests: 14 passed. Engine focused GUI tests: 10 passed. Browser preview showed no console warnings/errors.

The Games-wide test run was stopped after unrelated boxbound/mugen tests ran for over ten minutes; targeted Sudoku verification passed. Engine-wide gate results are recorded separately in this task's build logs.

Engine API surface check is blocked by the existing `@haiyue/ui capability entrypoints disagree with package exports` mismatch. This task does not change UI package exports. Engine core suite passed 655 tests; shader-language suite passed 112 tests.
