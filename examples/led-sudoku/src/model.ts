import { candidates, findHint, type Generated, type SaveData, type Hint } from '../../../../Games/games/led-sudoku/rules';
import { complete, editable, place, type Move } from '../../../../Games/games/led-sudoku/session';
export class MobileSession {
  state: SaveData | null = null;
  selected = -1;
  pencil = false;
  hint: Hint | null = null;
  history: Move[] = [];
  start(g: Generated): void { this.restore({ ...g, board: g.puzzle.givens.slice(), notes: Array(81).fill(0), elapsed: 0, assisted: false }); }
  restore(s: SaveData): void { this.state = s; this.history = []; this.pencil = false; this.hint = null; this.selected = s.puzzle.givens.findIndex((v, i) => !v && !s.puzzle.blocked[i]); }
  get done(): boolean { return !!this.state && complete(this.state); }
  get choices(): number[] { return this.state && editable(this.state, this.selected) ? candidates(this.state.puzzle, this.state.board, this.selected) : []; }
  select(i: number): void { if (this.state && i >= 0 && i < 81 && !this.state.puzzle.blocked[i]) { this.selected = i; this.hint = null; } }
  private remember(): void { if (this.state) { this.history.push({ board: this.state.board.slice(), notes: this.state.notes.slice() }); if (this.history.length > 200) this.history.shift(); } }
  input(d: number): boolean { if (!this.state) return false; const next = place(this.state, this.selected, d, this.pencil); if (!next) return false; this.remember(); this.state = next; this.hint = null; return true; }
  undo(): boolean { const previous = this.history.pop(); if (!this.state || !previous) return false; this.state = { ...this.state, ...previous }; this.hint = null; return true; }
  answer(): void { if (!this.state) return; this.remember(); this.state = { ...this.state, board: this.state.solution.slice(), notes: Array(81).fill(0), assisted: true }; this.hint = null; }
  explain(): string {
    if (!this.state) return '';
    const wrong = this.state.board.findIndex((v, i) => v && v !== this.state!.solution[i]);
    if (wrong >= 0) { this.selected = wrong; return '先修正高亮的错误填数，再继续推理。'; }
    this.hint = findHint(this.state.puzzle, this.state.board);
    if (this.hint) { this.selected = this.hint.cell; return this.hint.explanation; }
    return this.done ? '棋局已完成。' : '暂无单候选或唯一位置提示，需要组合推理。';
  }
}
