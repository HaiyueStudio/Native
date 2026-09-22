import { GuiButton } from '@haiyue/engine/gui';
import { isSaveData, type SaveData } from '../../../../Games/games/led-sudoku/rules';
import fixture from '../../../../Games/games/led-sudoku/evidence/hints/elimination.json';
import { captureDiagnostics } from './diagnostics';
import type { EngineGame } from './engine-page';
export async function runGuiSmoke(game: EngineGame, report: (event: string, detail: unknown) => void) {
  let checks = 0;
  const check = (ok: unknown, name: string) => {
      if (!ok) throw Error(name);
      checks++;
      report('gui-check', { name, passed: true });
    },
    wait = () => new Promise((r) => setTimeout(r, 650));
  const gui = game.gui!,
    c = game.controller,
    s = c.session;
  const pointer = async (action: 'down' | 'up', x: number, y: number) => {
    game.input.target.handle(action, [{ id: 7, x, y }]);
    game.requestFrame();
    await new Promise((r) => setTimeout(r, 100));
  };
  const tap = async (id: string) => {
    const node = gui.root.findById(id);
    check(node instanceof GuiButton && !node.disabled, `${id} enabled`);
    const r = node!.rect;
    await pointer('down', r.x + r.width / 2, r.y + r.height / 2);
    await pointer('up', r.x + r.width / 2, r.y + r.height / 2);
  };
  try {
    check(gui.snapshot().gui === 'Haiyue GuiSystem', 'HUD uses engine GUI');
    await wait();
    captureDiagnostics(game.page, 'led-gui-dark.png');
    await tap('settings');
    check(c.page === 'settings', 'engine settings opens');
    gui.language.setValue('en', true);
    check(c.preferences.language === 'en', 'language select');
    gui.theme.setValue('light-blue', true);
    check(c.preferences.theme === 'light-blue', 'theme select');
    await wait();
    captureDiagnostics(game.page, 'led-gui-settings.png');
    gui.language.setValue('ja', true);
    check(c.preferences.language === 'ja', 'Japanese');
    gui.language.setValue('zh', true);
    await tap('preferences-done');
    await tap('new');
    check(c.page === 'new', 'engine new-puzzle page');
    const help = gui.ruleRows.get('led')!.help;
    const hr = help.rect;
    await pointer('down', hr.x + hr.width / 2, hr.y + hr.height / 2);
    check(gui.help.visible, 'hold help opens');
    await wait();
    captureDiagnostics(game.page, 'led-gui-help.png');
    await pointer('up', hr.x + hr.width / 2, hr.y + hr.height / 2);
    check(!gui.help.visible, 'release help closes');
    gui.ruleRows.get('staircase')!.toggle.setChecked(true, true);
    await tap('difficulty-hard');
    await wait();
    captureDiagnostics(game.page, 'led-gui-new.png');
    await tap('rules-start');
    check(c.page === 'game', 'start dismisses settings');
    await wait();
    for (let i = 0; c.loading && i < 40; i++) await wait();
    check(!c.loading && s.state?.puzzle.options.staircase, 'worker generates staircase');
    check(isSaveData(s.snapshot()), 'staircase save valid');
    c.restore(structuredClone(fixture) as SaveData);
    const before = JSON.stringify(s.state);
    await tap('explain');
    check(c.lesson === 0, 'explanation opens');
    for (let i = 0; c.lesson >= 0 && i < 30; i++) await tap('lesson-next');
    check(
      s.history.length === 1 && s.state!.deductionSteps === 1,
      'applied candidate hint creates undo step',
    );
    await game.flush();
    const saved = await game.save.load();
    check(isSaveData(saved) && saved.undoHistory?.length === 1, 'undo history persists');
    c.restore(saved!);
    await tap('undo');
    check(s.state!.deductionSteps === 0 && s.state!.crossed === undefined, 'reloaded hint can be undone');
    await tap('answer');
    check(gui.confirmation.visible, 'answer uses engine modal');
    gui.confirmation.close('confirm');
    check(s.done && gui.answer.disabled, 'completed answer disabled');
    await tap('undo');
    check(!s.done, 'answer undo');
    await wait();
    captureDiagnostics(game.page, 'led-gui-light.png');
    report('gui-complete', { passed: true, checks, snapshot: game.snapshot(), baselineBytes: before.length });
  } catch (error) {
    report('gui-failed', { checks, error: String(error), snapshot: game.snapshot() });
  }
}
