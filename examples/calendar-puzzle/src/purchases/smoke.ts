import type { CalendarPuzzleGame } from '../../../../../Games/games/calendar-puzzle/CalendarPuzzleGame';
import type { NativeTouchInput } from '../../../../bridge/input/native-touch';
import type { Canvas } from '@nativescript/canvas';
import { captureSurfaceFrame } from '../../../../bridge/render/frame-capture';

/** Debug-only, isolated saves, real store reads. Never launches checkout.
 * Restore authentication is allowed only with the explicit restore test flag. */
export function installPurchaseSmoke(game: CalendarPuzzleGame, input: NativeTouchInput, canvas: Canvas,
  report: (event: string, data: unknown) => void, requestFrame: () => void, restorePurchased = false): () => void {
  let closed = false;
  const checks: Array<{ name: string; passed: boolean }> = [];
  const delay = async (ms = 180) => { await new Promise(resolve => setTimeout(resolve, ms)); if (closed) throw new Error('disposed'); };
  const check = (name: string, passed: boolean) => { checks.push({ name, passed }); report('purchase-smoke-check', { name, passed }); };
  const tap = (id: string) => {
    const rect = game.snapshot().ui[id];
    if (!rect) throw new Error(`Missing purchase smoke control: ${id}`);
    const point = { id: 9101, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    input.target.handle('down', [point]); input.target.handle('up', [point]); requestFrame();
  };
  const capture = (name: string) => report('purchase-ui-capture', captureSurfaceFrame(canvas, name + '.png'));
  void (async () => {
    await delay(2000);
    const deadline = Date.now() + 45000;
    while (game.snapshot().purchases?.busy && Date.now() < deadline) await delay(200);
    const initial = game.snapshot();
    check('native store completes its initial entitlement query', !!initial.purchases && !initial.purchases.busy);
    report('purchase-store-state', initial.purchases);
    if (initial.purchases?.entitled) {
      check('verified ownership enables unlimited hints after restart', initial.rewards?.unlimited === true);
      tap('settings'); await delay(); tap('languageSelect'); await delay();
      const menu = game.snapshot().languageMenu!;
      const point = { id: 9101, x: menu.popup.x + menu.popup.width / 2, y: menu.popup.y + (menu.values.indexOf('en') + .5) * menu.optionHeight - menu.scrollY };
      input.target.handle('down', [point]); input.target.handle('up', [point]); requestFrame(); await delay();
      check('owned settings offers restore instead of an upgrade', game.snapshot().ui.settingsPurchases?.text === 'Restore purchases');
      capture('iphone-iap-owned-settings');
      tap('done'); await delay(); tap('calendar'); await delay();
      const index = game.snapshot().history.cells.findIndex(cell => cell && cell.day !== initial.day);
      const target = game.snapshot().history.cells[index]!;
      tap('calendarDay' + index); await delay();
      check('verified owner can select another date without a paywall', game.snapshot().day === target.day && !game.snapshot().purchaseOpen);
      if (restorePurchased) {
        tap('settings'); await delay(); tap('settingsPurchases'); await delay();
        const restoreDeadline = Date.now() + 120000;
        while (game.snapshot().purchases?.busy && Date.now() < restoreDeadline) await delay(200);
        const restored = game.snapshot();
        check('explicit restore returns verified full ownership', restored.purchases?.entitled === true && restored.purchases.phase === 'restored' && !restored.purchases.busy);
        check('owned panel hides the purchase button and price', restored.ui.purchaseBuy?.visible === false && restored.ui.purchasePrice?.visible === false);
        check('owned panel retains restore access', restored.ui.purchaseRestore?.visible === true);
        capture('iphone-iap-owned-restored');
        tap('purchaseClose'); await delay();
      }
      report('purchase-smoke-complete', { mode: 'owned', passed: checks.every(check => check.passed), checks, store: game.snapshot().purchases });
      return;
    }
    const today = new Date();
    check('free mode starts on today', initial.year === today.getFullYear() && initial.month === today.getMonth() + 1 && initial.day === today.getDate());
    const original = JSON.stringify(initial.pieces);
    tap('settings'); await delay(); tap('settingsPurchases'); await delay();
    check('settings opens unlock panel without solving', game.snapshot().purchaseOpen && !game.snapshot().hintBusy && !game.snapshot().hintUsed);
    capture('iphone-iap-zh'); tap('purchaseClose'); await delay();
    check('closing paywall preserves every puzzle piece', !game.snapshot().purchaseOpen && JSON.stringify(game.snapshot().pieces) === original);
    tap('calendar'); await delay();
    check('calendar history is free to browse', game.snapshot().historyOpen);
    const index = game.snapshot().history.cells.findIndex(cell => cell && cell.day !== today.getDate());
    tap('calendarDay' + index); await delay();
    check('another date opens unlock panel and preserves selected date', game.snapshot().purchaseOpen && game.snapshot().day === today.getDate());
    tap('purchaseToday'); await delay();
    check('play today returns to free puzzle without assistance', !game.snapshot().purchaseOpen && !game.snapshot().hintUsed);
    for (const language of ['en', 'ja', 'fr', 'de', 'es', 'zh'] as const) {
      tap('settings'); await delay(); tap('languageSelect'); await delay();
      const menu = game.snapshot().languageMenu!;
      check(`${language} dropdown opens within the viewport`, menu.open && menu.popup.y + menu.popup.height <= input.target.getBoundingClientRect().height);
      if (language === 'fr') capture('language-dropdown');
      const point = { id: 9101, x: menu.popup.x + menu.popup.width / 2, y: menu.popup.y + (menu.values.indexOf(language) + .5) * menu.optionHeight - menu.scrollY };
      input.target.handle('down', [point]); input.target.handle('up', [point]); requestFrame(); await delay();
      check(`${language} selection closes dropdown`, !game.snapshot().languageMenu?.open && game.snapshot().language === language);
      capture('settings-' + language);
      tap('settingsPurchases'); await delay();
      check(`${language} settings opens unlock panel`, game.snapshot().language === language && game.snapshot().purchaseOpen);
      capture('iphone-iap-' + language); tap('purchaseClose'); await delay();
    }
    check('no checkout was launched during validation', !['purchasing', 'pending'].includes(game.snapshot().purchases?.phase ?? ''));
    await game.flushSave(); capture('iphone-iap-free');
    tap('settings'); await delay(); tap('languageSelect'); await delay(); tap('languageSelect'); await delay();
    check('closing dropdown without a selection preserves language', game.snapshot().language === 'zh' && !game.snapshot().languageMenu?.open);
    tap('done'); await delay();
    for (const id of ['rotate', 'flip', 'shuffle']) {
      tap(id); await delay();
      const state = game.snapshot().ui[id]!;
      check(`${id} touch release clears button feedback`, !state.hovered && !state.pressed && !state.focused);
    }
    const rect = game.snapshot().ui.rotate!;
    const point = { id: 9101, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    input.target.handle('down', [point]); requestFrame(); await delay();
    check('held button keeps press feedback', game.snapshot().ui.rotate!.pressed);
    capture('toolbar-pressed');
    input.target.handle('cancel', [point]); requestFrame(); await delay();
    check('cancelled touch clears button feedback', !game.snapshot().ui.rotate!.hovered && !game.snapshot().ui.rotate!.pressed && !game.snapshot().ui.rotate!.focused);
    capture('toolbar-released');
    report('purchase-smoke-complete', { passed: checks.every(check => check.passed), checks, store: game.snapshot().purchases });
  })().catch(error => { if (!closed) report('purchase-smoke-error', { message: String(error), checks }); });
  return () => { closed = true; };
}
