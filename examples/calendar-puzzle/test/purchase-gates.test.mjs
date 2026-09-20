import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function module(file, modules = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(js, { exports, require: name => modules[name] ?? {}, Date, console, performance }); return exports;
}
const purchases = module('../../../../Games/games/calendar-puzzle/purchases.ts');
const { CalendarPuzzleGame } = module('../../../../Games/games/calendar-puzzle/CalendarPuzzleGame.ts', { '@haiyue/engine/gui': { GuiRoot: class {} }, './purchases': purchases, './model': { calendarWeekday: (y, m, d) => new Date(y, m - 1, d).getDay() } });
function fixture(entitled = false) {
  const game = Object.create(CalendarPuzzleGame.prototype);
  const today = new Date(); let opens = 0, resets = 0, saves = 0, transforms = 0;
  Object.assign(game, { platform: { purchases: { snapshot: () => ({ entitled }) } }, selectedYear: today.getFullYear(), selectedMonth: today.getMonth() + 1, selectedDay: today.getDate(),
    hintUsed: false, purchaseView: { visible: false }, togglePurchase: () => { opens++; }, audio: { cue() {} }, toggleHistory() {}, refreshLanguage() {},
    applySelectedDate: () => { resets++; }, saveState: () => { saves++; }, transformSelected: () => { transforms++; },
  });
  return { game, values: () => ({ opens, resets, saves, transforms }) };
}
test('locked date selection preserves date, puzzle and save; today remains free', () => {
  const { game, values } = fixture(); const original = game.selectedYear;
  game.chooseDate(2000, 1, 1);
  assert.equal(game.selectedYear, original); assert.deepEqual(values(), { opens: 1, resets: 0, saves: 0, transforms: 0 });
  game.chooseDate(game.selectedYear, game.selectedMonth, game.selectedDay);
  assert.equal(values().saves, 1); assert.equal(values().resets, 0);
});
test('full access selects any date, but revocation gates gestures and toolbar actions', () => {
  const { game, values } = fixture(true); game.chooseDate(2000, 1, 1);
  assert.equal(game.selectedYear, 2000); assert.equal(values().resets, 1);
  game.rotateSelected(); game.flipSelected(); assert.equal(values().transforms, 2);
  game.platform.purchases.snapshot = () => ({ entitled: false });
  game.rotateSelected(); game.flipSelected(); game.resetPieces(true);
  assert.equal(values().transforms, 2); assert.equal(values().opens, 3);
});
test('locked hint never starts solver and never marks a clean completion as assisted', async () => {
  const { game, values } = fixture(); game.solver = { solve: () => { throw Error('must not run'); } };
  await game.requestHint(); assert.equal(game.hintUsed, false); assert.equal(values().opens, 1);
});
test('purchase panel blocks gameplay while visible, web embedding remains fully enabled', () => {
  const { game } = fixture(true); game.purchaseView.visible = true; assert.equal(game.allowPlay(), false);
  game.purchaseView.visible = false; delete game.platform.purchases; assert.equal(game.canPlayDate(2000, 1, 1), true);
});
