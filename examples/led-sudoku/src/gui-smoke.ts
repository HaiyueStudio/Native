import { nativeLaunchFlag } from '../../../bridge/lifecycle/launch-flags';
import { GuiButton } from '@haiyue/engine/gui';
import { isSaveData, type SaveData } from '../../../../Games/games/led-sudoku/rules';
import fixture from '../../../../Games/games/led-sudoku/evidence/hints/elimination.json';
import { captureDiagnostics } from './diagnostics';
import type { EngineGame } from './engine-page';
export async function runGuiSmoke(
  game: EngineGame,
  report: (event: string, detail: unknown) => void,
) {
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
  const pointer = async (action: 'down' | 'move' | 'up', x: number, y: number, delay = 100) => {
    game.input.target.handle(action, [{ id: 7, x, y }]);
    game.requestFrame();
    await new Promise((r) => setTimeout(r, delay));
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
    const settings = gui.root.findById('settings')!;
    const sr = settings.rect, sx = sr.x + sr.width / 2, sy = sr.y + sr.height / 2;
    // A real fast tap can end before the next GUI frame drains its input queue.
    game.input.target.handle('down', [{ id: 7, x: sx, y: sy }]);
    game.input.target.handle('up', [{ id: 7, x: sx, y: sy }]);
    game.requestFrame();
    await wait();
    check(c.page === 'settings', 'fast completed touch opens settings without capturing expired touch');
    check(c.page === 'settings', 'engine settings opens');
    check(gui.statsButton.rect.y < gui.langLabel.rect.y, 'completion records appear first in settings');
    await tap('statistics');
    check(c.page === 'statistics' && gui.statsList.contentHeight > 0, 'completion statistics open in scrollable engine GUI');
    await wait();
    captureDiagnostics(game.page, 'led-gui-statistics.png');
    await tap('statistics-back');
    check(!gui.tools.has('hint') && gui.tools.has('explain') && gui.tools.has('export'), 'single explanation and export toolbar actions');
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
    await tap('rules');
    check(c.page === 'rules' && !gui.root.findById('info-up') && !gui.root.findById('info-down'), 'rules use a scroll view without footer arrows');
    check(gui.infoBody.contentHeight > 0 && gui.infoBody.inertia, 'rules text uses inertial scrolling');
    await wait();
    captureDiagnostics(game.page, 'led-gui-rules.png');
    await tap('info-back');
    await tap('new');
    check(c.page === 'new', 'engine new-puzzle page');
    const help = gui.ruleRows.get('led')!.help;
    const hr = help.rect;
    check(hr.width === 24 && hr.height === 24, 'rule help shrinks by thirty percent');
    await pointer('down', hr.x + hr.width / 2, hr.y + hr.height / 2);
    check(!gui.help.visible, 'pointer down does not open help');
    await pointer('up', hr.x + hr.width / 2, hr.y + hr.height / 2);
    check(gui.help.visible, 'tap help stays open after release');
    await wait();
    captureDiagnostics(game.page, 'led-gui-help.png');
    const dr = gui.help.dialogRect;
    await pointer('down', dr.x + 6, dr.y + 6);
    await pointer('up', dr.x + 6, dr.y + 6);
    check(gui.help.visible, 'interior blank area does not close help');
    await tap(gui.help.closeButton.id);
    check(!gui.help.visible, 'close button dismisses help');
    await tap(help.id);
    await pointer('down', 2, 2);
    await pointer('up', 2, 2);
    check(!gui.help.visible, 'backdrop dismisses help');
    const toggle = gui.ruleRows.get('led')!.toggle,
      was = toggle.checked,
      tr = { ...toggle.rect };
    await pointer('down', tr.x + 20, tr.y + 15);
    await pointer('move', tr.x + 20, tr.y - 85);
    await pointer('up', tr.x + 20, tr.y - 85);
    check(
      gui.ruleList.scrollY > 0 && toggle.checked === was,
      'dragging a switch scrolls without toggling',
    );
    check(toggle.thumbTransitionMs === 200 && toggle.colorTransitionMs === 200, 'switch motion uses 200 ms for thumb and color');
    gui.ruleList.scrollTo(0);
    const vx = gui.ruleList.rect.x + 20, vy = gui.ruleList.rect.y + 130;
    await pointer('down', vx, vy, 16);
    await pointer('move', vx, vy - 40, 16);
    await pointer('move', vx, vy - 80, 16);
    await pointer('up', vx, vy - 80, 16);
    const releasedOffset = gui.ruleList.scrollY;
    await wait();
    check(gui.ruleList.scrollY > releasedOffset + 1, 'inertial scrolling continues after release on demand-rendered Native');
    await pointer('down', vx, vy, 16);
    await pointer('up', vx, vy, 16);
    check(!gui.ruleList.animating, 'new contact stops momentum');
    gui.ruleList.scrollTo(gui.ruleList.maxScrollY);
    await wait();
    const last = Array.from(gui.ruleRows.values()).at(-1)!;
    check(
      last.help.rect.y >= gui.ruleList.rect.y &&
        last.help.rect.y + last.help.rect.height <= gui.ruleList.rect.y + gui.ruleList.rect.height,
      'last rule reachable without pagination',
    );
    await tap(last.help.id);
    check(gui.help.visible, 'scrolled rule help can be opened');
    await tap(gui.help.closeButton.id);
    gui.ruleList.scrollTo(0);
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
    check(!gui.root.findById('text-up') && !gui.root.findById('text-down'), 'lesson has no arrow buttons');
    const step = s.hint!.steps[0]!, originalText = step.text;
    step.text = Array(24).fill(originalText).join('\n');
    gui.update(false);
    await wait();
    const lr = gui.lessonBody.rect;
    await pointer('down', lr.x + lr.width / 2, lr.y + lr.height - 10);
    await pointer('move', lr.x + lr.width / 2, lr.y + 10);
    await pointer('up', lr.x + lr.width / 2, lr.y + 10);
    check(gui.lessonBody.scrollY > 0, 'long lesson scrolls by dragging text');
    await tap('lesson-next');
    check(gui.lessonBody.scrollY === 0, 'changing lesson resets text scroll');
    await tap('lesson-previous');
    step.text = originalText;
    gui.update(false);
    check(gui.lessonBody.scrollY === 0, 'short lesson has no stale scroll offset');
    await wait();
    captureDiagnostics(game.page, 'led-gui-lesson.png');
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
    check(
      s.state!.deductionSteps === 0 && s.state!.crossed === undefined,
      'reloaded hint can be undone',
    );
    await tap('answer');
    check(gui.confirmation.visible, 'answer uses engine modal');
    gui.confirmation.close('confirm');
    check(s.done && gui.answer.disabled, 'completed answer disabled');
    await tap('undo');
    check(!s.done, 'answer undo');
    await wait();
    captureDiagnostics(game.page, 'led-gui-light.png');
    if (nativeLaunchFlag('LED_EXPORT_SMOKE')) {
      await tap('export');
      for (let i = 0; i < 90 && gui.tools.get('export')!.disabled; i++) await wait();
      check(c.status === c.text('exportSaved'), 'export saved successfully to photo library');
      report('photo-export-complete', { status: c.status });
    }
    report('gui-complete', {
      passed: true,
      checks,
      snapshot: game.snapshot(),
      baselineBytes: before.length,
    });
  } catch (error) {
    report('gui-failed', { checks, error: String(error), snapshot: game.snapshot() });
  }
}
