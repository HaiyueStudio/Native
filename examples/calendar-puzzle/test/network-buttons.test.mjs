import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

class Element {
  constructor(options = {}) { this.visible = true; this.disabled = false; Object.assign(this, options); }
  setVisible(value) { this.visible = value; }
  setText(value) { this.text = value; }
  setFontSize() {} markDirty() {} setSource() {}
  setStyle(value) { this.style = { ...this.style, ...value }; }
}
const gui = { GuiElement: Element, GuiButton: Element, GuiLabel: Element, GuiImage: Element };
function load(name, modules = {}) {
  const exports = {};
  const source = readFileSync(new URL(`../../../../Games/games/calendar-puzzle/${name}.ts`, import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: name => modules[name] ?? gui, performance });
  return exports;
}
const network = load('network-buttons');
const { CalendarPurchaseView } = load('purchase-ui', { './network-buttons': network, './raster-surface': load('raster-surface') });
const { CalendarRewardView } = load('reward-ui', { './network-buttons': network });
function options() {
  const controls = {}, elements = [];
  return { controls, elements, root: { theme: { colors: { text: '#243d3b', textMuted: '#607572', primary: '#17847b' } }, add: element => elements.push(element) },
    layout: () => ({ width: 1600, height: 720, scale: 1 }), language: () => 'zh',
    register: (id, element) => { controls[id] = element; }, close() {}, today() {},
    raster: { canvas: () => ({ getContext: () => ({ setTransform() {}, clearRect() {}, measureText: () => ({ width: 150 }), fillText() {} }) }) },
  };
}
test('store prerequisites start disabled with animated indicators; ready, pending and errors stop loading', () => {
  const o = options();let purchases = 0, restores = 0;
  let state = { entitled: false, busy: false, phase: 'loading', price: null, canPurchase: false };
  const view = new CalendarPurchaseView({ ...o, purchases: { snapshot: () => state,
    purchase() { purchases++;state = { ...state, busy: true, phase: 'purchasing' };view.refresh(); },
    restore() { restores++; }, refresh() {} } });
  view.setVisible(true);
  assert.equal(view.isAnimating, true);
  for (const id of ['purchaseBuy','purchaseRestore','purchaseRetry']) {
    assert.equal(o.controls[id].disabled, true);o.controls[id].onClick();
  }
  assert.equal(restores, 0);assert.equal(purchases, 0);
  view.update(0);const colors = o.elements.map(e => e.style?.backgroundColor);
  view.update(180);assert.notDeepEqual(o.elements.map(e => e.style?.backgroundColor), colors);
  assert.equal(o.controls.purchaseToday.disabled, false);assert.equal(o.controls.purchaseClose.disabled, false);
  state = { ...state, price: '¥18.00', canPurchase: true, phase: 'ready' };view.refresh();
  assert.equal(view.isAnimating, false);assert.equal(o.controls.purchaseBuy.disabled, false);
  for(let i=0;i<20;i++)o.controls.purchaseBuy.onClick();
  assert.equal(purchases, 1);assert.equal(view.isAnimating, true);assert.equal(o.controls.purchasePrice.visible, false);
  view.setVisible(false);assert.equal(view.isAnimating, false);
  state = { ...state, busy: false, phase: 'offline' };view.setVisible(true);
  assert.equal(view.isAnimating, false);assert.equal(o.controls.purchasePrice.visible, true);
  state = { ...state, phase: 'pending' };view.refresh();
  assert.equal(view.isAnimating, false);assert.equal(o.controls.purchaseBuy.disabled, true);
  state = { ...state, busy: true, phase: 'restoring' };view.refresh();
  assert.equal(view.network.loading(o.controls.purchaseRestore), true);
  assert.equal(view.network.loading(o.controls.purchaseBuy), false);
  assert.equal(o.controls.purchaseRestore.disabled, true);
});
test('reward initialization blocks only network buttons and watch keeps animating while downloading', () => {
  const o = options();let requests = 0;
  let state = { unlimited: false, free: 1, credits: 0, adsRemaining: 2, busy: false, initializing: true, presenting: false, operation: null, phase: 'ready' };
  const view = new CalendarRewardView({ ...o, use() {}, buy() {}, rewards: { snapshot: () => state,
    watch() { requests++;state = { ...state, busy: true, operation: 'ad', phase: 'loading' };view.refresh(); } } });
  view.setVisible(true);
  assert.equal(o.controls.rewardWatch.disabled, true);assert.equal(o.controls.rewardWatchText.visible, false);
  assert.equal(o.controls.rewardUse.disabled, false);assert.equal(o.controls.rewardClose.disabled, false);
  assert.equal(view.isAnimating, true);o.controls.rewardWatch.onClick();assert.equal(requests, 0);
  state = { ...state, initializing: false };view.refresh();
  assert.equal(view.isAnimating, false);assert.equal(o.controls.rewardWatchText.visible, true);
  for(let i=0;i<20;i++)o.controls.rewardWatch.onClick();
  assert.equal(requests, 1);assert.equal(view.isAnimating, true);
  state = { ...state, presenting: true };view.refresh();assert.equal(view.isAnimating, false);
  state = { ...state, presenting: false };view.refresh();assert.equal(view.isAnimating, true);
  state = { ...state, busy: false, operation: null, phase: 'unavailable' };view.refresh();
  assert.equal(view.isAnimating, false);assert.equal(o.controls.rewardWatch.disabled, false);
  view.setVisible(false);assert.equal(view.isAnimating, false);
});
test('network tap debounce is immediate, ignores burst clicks and never queues a delayed action', () => {
  const control = new Element();let time = 0, calls = 0;
  const click = network.calendarNetworkAction(() => control, () => calls++, () => time);
  click();assert.equal(calls, 1);
  time = 399;click();assert.equal(calls, 1);
  time = 400;click();assert.equal(calls, 2);
  time = 900;control.disabled = true;click();assert.equal(calls, 2);
  control.disabled = false;control.visible = false;click();assert.equal(calls, 2);
  control.visible = true;click();assert.equal(calls, 3);
});
