import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(file, modules) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: name => modules[name] });
  return exports;
}
class Element {
  constructor(options = {}) { Object.assign(this, options); }
  setVisible(value) { this.visible = value; }
  setText(value) { this.text = value; }
  setFontSize() {} markDirty() {}
  setSource(value) { this.source = value; }
}
const { CalendarRasterSurface } = load('../../../../Games/games/calendar-puzzle/raster-surface.ts', {});
const { CalendarPurchaseView } = load('../../../../Games/games/calendar-puzzle/purchase-ui.ts', { '@haiyue/engine/gui': { GuiButton: Element, GuiElement: Element, GuiLabel: Element, GuiImage: Element }, './raster-surface': { CalendarRasterSurface } });
test('purchase view renders exact localized price, disables pending/owned checkout and keeps restore accessible', () => {
  const controls = {}, drawn = [];
  let state = { entitled: false, phase: 'ready', price: '١٫٩٩\u00a0د.إ.', busy: false, canPurchase: true };
  const context = { setTransform() {}, clearRect() {}, measureText: () => ({ width: 240 }), fillText: text => drawn.push(text) };
  const view = new CalendarPurchaseView({ root: { add() {} }, raster: { canvas: () => ({ getContext: () => context }) }, layout: () => ({ width: 1600, height: 720, scale: 1 }), language: () => 'en',
    register: (id, control) => { controls[id] = control; }, close() {}, today() {}, purchases: { snapshot: () => state },
  });
  view.setVisible(true);
  assert.equal(drawn.at(-1), 'Buy · ١٫٩٩\u00a0د.إ.'); assert.equal(controls.purchasePrice.visible, true); assert.equal(controls.purchaseBuy.disabled, false);
  const count = drawn.length; view.refresh(); assert.equal(drawn.length, count);
  state = { ...state, phase: 'pending' }; view.refresh(); assert.equal(controls.purchaseBuy.disabled, true); assert.equal(controls.purchaseRestore.disabled, false);
  state = { ...state, entitled: true, phase: 'restored' }; view.refresh(); assert.equal(controls.purchaseBuy.disabled, true);
  assert.equal(controls.purchaseBuy.visible, false); assert.equal(controls.purchasePrice.visible, false);
  assert.equal(controls.purchaseFree.visible, false); assert.equal(controls.purchaseRestore.visible, true);
  assert.equal(controls.purchaseTitle.text, 'Full game unlocked');
  controls.purchaseRestore.layout(); assert.equal(controls.purchaseRestore.rect.x, 620);
  view.setVisible(false); view.setVisible(true); assert.equal(controls.purchaseBuy.visible, false);
  state = { ...state, entitled: false, phase: 'revoked' }; view.refresh();
  assert.equal(controls.purchaseBuy.visible, true); assert.equal(controls.purchasePrice.visible, true);
  assert.equal(controls.purchaseTitle.text, 'Unlock full game');
  controls.purchaseRestore.layout(); assert.equal(controls.purchaseRestore.rect.x, 810);
  state = { ...state, entitled: false, price: null, phase: 'offline', canPurchase: false }; view.refresh();
  assert.equal(controls.purchasePrice.visible, false); assert.equal(controls.purchaseBuy.text, 'Buy'); assert.equal(controls.purchaseBuy.disabled, true);
  view.setVisible(false); assert.equal(controls.purchaseBackdrop.visible, false); view.dispose();
});
