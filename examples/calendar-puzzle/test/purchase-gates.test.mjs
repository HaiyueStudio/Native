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
const { RewardController } = module('../../../bridge/rewards/controller.ts');
const { PresentationPause } = module('../../../bridge/lifecycle/presentation-pause.ts');
const { OrbitPointerTarget } = module('../../../bridge/input/pointer-target.ts');
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

test('cold-start calendar and next-day paywall input work before startup privacy request completes', async () => {
  const { game } = fixture();
  const input = new OrbitPointerTarget(() => ({ x: 0, y: 0, width: 1600, height: 720 }));
  const gate = new PresentationPause(() => input.suspend(), () => input.resume());
  let finish, action, historyVisible = false;
  const rewards = new RewardController({ dailyFree: 1, dailyAds: 2, storage: { read: () => null, write() {} },
    entitled: () => false, pause: () => gate.acquire(),
    gateway: { initialize: () => new Promise(resolve => { finish = resolve; }), privacyRequired: () => false, dispose() {} },
  });
  game.platform.rewards = rewards;
  Object.assign(game, { cancelInteraction() {}, cancelHint() {}, finishMotions() {}, updateStatus() {},
    historyView: { open() { historyVisible = true; }, setVisible(value) { historyVisible = value; } },
    mainControls: [], purchaseView: { visible: false, setVisible(value) { this.visible = value; } },
    toggleSettings() {},
  });
  game.toggleHistory = CalendarPuzzleGame.prototype.toggleHistory;
  game.togglePurchase = CalendarPuzzleGame.prototype.togglePurchase;
  input.addEventListener('pointerup', () => action());
  const tap = callback => { action = callback; input.handle('down', [{ id: 1, x: 10, y: 10 }]); input.handle('up', [{ id: 1, x: 10, y: 10 }]); };
  const startup = rewards.initialize();
  tap(() => game.toggleHistory(true));assert.equal(historyVisible, true);

  // Resume yesterday's saved puzzle with the same startup request still pending.
  gate.setBackground(true);
  const yesterday = new Date();yesterday.setDate(yesterday.getDate() - 1);
  game.selectedYear = yesterday.getFullYear();game.selectedMonth = yesterday.getMonth() + 1;game.selectedDay = yesterday.getDate();
  gate.setBackground(false);rewards.refresh();
  assert.equal(game.canPlayDate(), false);game.togglePurchase(true);
  tap(() => game.togglePurchase(false));assert.equal(game.purchaseView.visible, false);
  game.togglePurchase(true);
  tap(() => {
    game.togglePurchase(false);const today = new Date();
    game.chooseDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  });
  assert.equal(game.purchaseView.visible, false);assert.equal(game.canPlayDate(), true);
  assert.equal(input.snapshot().paused, false);assert.equal(rewards.snapshot().busy, false);
  finish();await startup;rewards.dispose();input.dispose();
});

function hintFixture({ solved = true, consume = () => true } = {}) {
  const {game}=fixture();let solves=0,shows=0,paywalls=0,credits=0;
  Object.defineProperty(game,'copy',{value:{hintNone:'none',hintUnavailable:'unavailable'}});
  const piece={placed:false,def:{cells:[{x:0,y:0}]}};
  Object.assign(game,{hintBusy:false,drag:null,motions:new Map(),pieces:[piece],selectedPiece:piece,hintRevision:0,disposed:false,
    selectedWeekday:0,hintOverlay:{placement:null,show(target){this.placement=target;shows++;}},
    cancelHint(){this.hintRevision++;this.hintBusy=false;},updateStatus(){},setSelectedPiece(){},
    solver:{cached:()=>null,async solve(){solves++;return solved ? {status:'solved',compatible:true,solution:[{piece:0,row:1,col:2,rotation:0,flipped:false}]} : {status:'timeout'};}},
    toggleRewards(){paywalls++;},
  });
  game.platform.rewards={snapshot:()=>({busy:false,unlimited:false,free:1,credits:0}),consume(key){credits++;return consume(key);}};
  return {game,stats:()=>({solves,shows,paywalls,credits})};
}
test('free hint is charged only after a useful solve and redisplaying it is free',async()=>{
  const {game,stats}=hintFixture();await game.requestHint();await game.requestHint();
  assert.deepEqual(stats(),{solves:1,shows:1,paywalls:0,credits:1});assert.equal(game.hintUsed,true);
});
test('failed solver never consumes allowance or marks the puzzle assisted',async()=>{
  const {game,stats}=hintFixture({solved:false});await game.requestHint();
  assert.equal(stats().credits,0);assert.equal(game.hintUsed,false);
});
test('exhausted quota opens opt-in panel without exposing hint or changing star eligibility',async()=>{
  const {game,stats}=hintFixture({consume:()=>false});await game.requestHint();
  assert.equal(stats().paywalls,1);assert.equal(stats().shows,0);assert.equal(game.hintUsed,false);
});
test('stale solver results after input never consume or display',async()=>{
  const {game,stats}=hintFixture();let solve;
  game.solver.solve=()=>new Promise(resolve=>{solve=resolve;});const request=game.requestHint();game.hintRevision++;
  solve({status:'solved',compatible:true,solution:[{piece:0,row:1,col:2,rotation:0,flipped:false}]});await request;
  assert.equal(stats().credits,0);assert.equal(stats().shows,0);
});

test('no remaining hint allowance opens the reward panel synchronously without running the solver',async()=>{
 const {game,stats}=hintFixture();game.platform.rewards.snapshot=()=>({busy:false,unlimited:false,free:0,credits:0});
 const request=game.requestHint();assert.equal(stats().paywalls,1);assert.equal(stats().solves,0);assert.equal(game.hintBusy,false);await request;
 assert.equal(game.hintUsed,false);assert.equal(stats().credits,0);
});
test('a cached already delivered hint can still be redisplayed with no allowance, without a search',async()=>{
 const {game,stats}=hintFixture();game.platform.rewards.snapshot=()=>({busy:false,unlimited:false,free:0,credits:0});
 game.solver.cached=()=>({status:'solved',compatible:true,solution:[{piece:0,row:1,col:2,rotation:0,flipped:false}],nodes:0});
 await game.requestHint();assert.equal(stats().solves,0);assert.equal(stats().shows,1);assert.equal(stats().paywalls,0);
});
test('an unpaid next step from cache opens the reward panel without another solve',async()=>{
 const {game,stats}=hintFixture({consume:()=>false});game.platform.rewards.snapshot=()=>({busy:false,unlimited:false,free:0,credits:0});
 game.solver.cached=()=>({status:'solved',compatible:true,solution:[{piece:0,row:1,col:2,rotation:0,flipped:false}],nodes:0});
 const pending=game.requestHint();assert.equal(stats().paywalls,1);assert.equal(stats().solves,0);assert.equal(stats().shows,0);await pending;
});
