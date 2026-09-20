import { DEFAULT_OPTIONS, analyzeSingles, meetsChallenge, candidates, isSaveData, search } from '../../../../Games/games/led-sudoku/rules';
import type { MobileGame } from './main-page';
/** Debug-only launch flag; uses a separate save namespace from the player's game. */
export async function runSmoke(game: MobileGame, report: (event: string, data: unknown) => void): Promise<void> {
  let checks = 0;
  const check = (ok: unknown, name: string) => { if (!ok) throw Error(`Smoke failed: ${name}`); checks++; report('smoke-check', { name, passed: true }); };
  try {
    const s = game.session;
    check(s.state && isSaveData(s.state), 'native generation and valid save');
    check(game.boardFrame.getActualSize().width > 250, 'portrait board size');
    check(game.keys.length === 9 && game.keys.every(k=>k.tile.getActualSize().height >= 44), 'nine touch targets');
    check(game.snapshot().splash === 'hidden', 'engine launch screen dismissed after presentation');
    const i = s.state!.puzzle.lights.findIndex(Boolean), v = s.state!.solution[i]; s.select(i); s.pencil = true; game.enter(v);
    check(s.state!.notes[i] !== 0 && !s.state!.board[i], 'notes'); s.pencil = false; game.enter(v); check(s.state!.board[i] === v, 'candidate placement');
    s.undo(); check(!s.state!.board[i], 'undo'); game.enter(v); game.enter(0); check(!s.state!.board[i], 'erase');
    check(s.explain().length > 0, 'hint explanation');
    await game.flush(); const restored = await game.save.load(); check(restored && restored.board.join() === s.state!.board.join(), 'native save restore');
    const all = { ...DEFAULT_OPTIONS, diagonal: true, missing: true, killer: true, renban: true, consecutive: true, inequality: true, multiDiagonal: true, exclusion: true, parity: true };
    await game.newGame(all, 20260920); check(isSaveData(s.state), 'all variants generation');
    check(s.state!.puzzle.lineRule === 'ordered' && s.state!.puzzle.lines.every(path => { const values = path.map(i => s.state!.solution[i]!); const step = values[1]! - values[0]!; return Math.abs(step) === 1 && values.every((v,n) => !n || v - values[n-1]! === step); }), 'continuous lines ascend or descend by one');
    check(s.state!.puzzle.slants?.length === 3 && s.state!.puzzle.exclusions!.length > 0, 'native variant data');
    check(search(s.state!.puzzle).count === 1, 'all variants uniqueness');
    s.answer(); game.commit('诊断：辅助完成'); check(s.done, 'complete'); s.undo(); game.commit('诊断：撤销'); check(!s.done, 'completion undo');
    await game.newGame({ ...all, led: false }, 77); check(s.state!.puzzle.lights.every(n=>!n), 'classic no cell LEDs'); check(s.state!.puzzle.exclusions!.every(e=>!e.mask), 'classic numeric exclusions');
    await game.newGame({ ...DEFAULT_OPTIONS, inequality:true, multiDiagonal:true, exclusion:true, parity:true }, 20260920);
    await game.flush(); check(isSaveData(await game.save.load()), 'combined save');
    for (const led of [true, false]) {
      const started = Date.now();
      await game.newGame({ ...DEFAULT_OPTIONS, difficulty:'hard', led }, 39);
      report('generation-timing', { name: led ? 'LED challenge' : 'classic challenge', seed: 39, ms: Date.now() - started });
      check(s.state!.puzzle.options.difficulty === 'hard' && s.state!.puzzle.options.led === led && meetsChallenge(analyzeSingles(s.state!.puzzle)), led ? 'LED challenge resists both singles techniques' : 'classic challenge resists both singles techniques');
    }
    const advanced = { ...DEFAULT_OPTIONS, difficulty:'hard' as const, thermometer:true, skyscraper:true, xv:true, quadruple:true };
    const started = Date.now();
    await game.newGame(advanced, 20260921);
    report('generation-timing', { name: 'advanced challenge', seed: 20260921, ms: Date.now() - started });
    check(s.state!.puzzle.thermometers!.length > 0 && s.state!.puzzle.fourSums!.length > 0 && !!s.state!.puzzle.skyClues && s.state!.puzzle.xvClues!.length > 0, 'four advanced variants generation');
    check(search(s.state!.puzzle).count === 1, 'advanced variants uniqueness');
    check(meetsChallenge(analyzeSingles(s.state!.puzzle)), 'advanced challenge resists both singles techniques');
    check(s.state!.board.every((v,i)=>v || candidates(s.state!.puzzle,s.state!.board,i).includes(s.state!.solution[i])), 'advanced candidates retain solution');
    await game.flush(); check(isSaveData(await game.save.load()), 'advanced variants save');
    game.message(`真机自动检查 ${checks} 项通过`); report('smoke-complete', { passed:true, checks, snapshot:game.snapshot() });
  } catch (error) { game.message(String(error)); report('smoke-failed', { passed:false, checks, error:String(error) }); }
}
