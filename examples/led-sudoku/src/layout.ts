/** DIP layout keeps the board square and every number button at least 44 DIP high. */
export function portraitLayout(width: number, height: number, top = 24, bottom = 16) {
  const contentWidth = Math.max(240, width - 20);
  const available = Math.max(0, height - top - bottom);
  const fixed = 40 + 22 + 44 + 24 + 40 + 44 + 8;
  const board = Math.floor(Math.min(contentWidth, Math.max(252, available - fixed - 150)));
  const keypad = Math.max(150, Math.min(210, available - fixed - board));
  const contentHeight = Math.max(available, fixed + board + keypad);
  return { board, keypad, contentWidth, contentHeight, scroll: contentHeight > available, rows: `40,22,${board},44,24,${keypad},40,*,44` };
}
