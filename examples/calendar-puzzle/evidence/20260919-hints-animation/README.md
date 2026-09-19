# Calendar puzzle: hints, toolbar and piece animation (2026-09-19)

Installed and verified on iPhone 15 Plus using the existing application identifier and save container.

## Changes

- Completed-date count is back in the lower calendar row, clear of the maximum two date cells in that row.
- Four square icon buttons above the tray: rotate, flip, shuffle and lightbulb hint.
- Algorithm X / dancing-links solver runs in a dedicated Web/NativeScript worker. Compatible placed pieces are preserved; incompatible partial boards get an explicit adjustment instruction. Hints highlight one piece and the target cells without moving pieces automatically.
- Solver requests have cancellation, IDs, a search/time budget and an 8-second worker timeout. No synchronous main-thread fallback.
- Rotation eases over 240 ms; flip uses a 300 ms squash/expand transition; shuffle moves and reorients pieces over 420 ms with a 14 ms stagger and slight arc.
- Touch picking is suspended while pieces animate; settled visuals use the same final state as snapping and saving.

## Validation

- Games and native TypeScript checks passed.
- Targeted Web build and signed iPhone build passed.
- Six new deterministic tests passed: all months/weekdays (84 dates), exact coverage, pinned/symmetric pieces, invalid and incompatible partial boards, worker cancellation/stale results, and animation endpoints across every piece/orientation/flip.
- Built Web solver function verified standalone, with no closure dependencies.
- Native unit tests: 5 passed.
- Full Games suite: 658 tests, 636 passed, 20 skipped, 2 pre-existing unrelated failures (HYMUGEN canonical packing and viewer-product control assertion); no calendar-puzzle failures.
- Real-device smoke: 21/21 passed (see `smoke-host.jsonl`), including native worker hint, completing the hinted piece by dragging, victory/history/save flow, three languages and all animation lifecycles.
- Screenshots were visually inspected: `hint-target.png`, `history-six-weeks.png`, animation captures and `iphone-final.png`.
- Smoke uses an isolated save namespace. Normal app restored to the user's September 24, 2026 puzzle; see `normal-host.jsonl`.
