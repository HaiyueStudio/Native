import sumFixture from '../../../../Games/games/led-sudoku/evidence/hints/little-killer-45-stalled.json';
import { littleKillerPath } from '../../../../Games/games/led-sudoku/little-killer';
import noteSyncFixture from '../../../../Games/games/led-sudoku/evidence/hints/notebook-stale-crosses.json';
import advancedFixture from '../../../../Games/games/led-sudoku/evidence/hints/missing-xv-stalled.json';
import chainFixture from '../../../../Games/games/led-sudoku/evidence/hints/missing-xv-chain.json';
import eliminationFixture from '../../../../Games/games/led-sudoku/evidence/hints/elimination.json';
import type { SaveData } from '../../../../Games/games/led-sudoku/rules';
import { DEFAULT_OPTIONS, diagonalNeighbors, analyzeSingles, meetsChallenge, candidates, isSaveData, search, pruneImpliedInequalities, type Puzzle } from '../../../../Games/games/led-sudoku/rules';
import hintFixture from '../../../../Games/games/led-sudoku/evidence/hints/screenshot.json';
import type { MobileGame } from './main-page';
import { Button, GestureTypes, GridLayout, Page, Switch } from '@nativescript/core';
import { SelectionDropdown } from './dropdown';
import { captureDiagnostics } from './diagnostics';
import { showSettings } from './settings';
/** Debug-only launch flag; uses a separate save namespace from the player's game. */
export async function runSmoke(game: MobileGame, report: (event: string, data: unknown) => void): Promise<void> {
  let checks = 0;
  const check = (ok: unknown, name: string) => { if (!ok) throw Error(`Smoke failed: ${name}`); checks++; report('smoke-check', { name, passed: true }); };
  try {
    const s = game.session;
    check(s.state && isSaveData(s.state), 'native generation and valid save');
    if(!s.state!.puzzle.lights.some(Boolean))await game.newGame({...DEFAULT_OPTIONS},20260921);
    check(game.boardFrame.getActualSize().width > 250, 'portrait board size');
    check(game.keys.length === 9 && game.keys.every(k=>k.tile.getActualSize().height >= 44), 'nine touch targets');
    check(game.snapshot().splash === 'hidden', 'engine launch screen dismissed after presentation');
    check(game.toolButtons.length===6 && game.toolButtons.every(b=>{const z=b.getActualSize();return z.width>=44&&Math.abs(z.width-z.height)<1;}), 'six square icon tools');
    const wait=()=>new Promise(resolve=>setTimeout(resolve,650));
    const tap=(b:Button)=>b.notify({eventName:'tap',object:b});
    tap(game.toolButtons[5]!.hit);await wait();
    const settings=game.page.modal as Page;check(settings instanceof Page,'gear opens settings panel');
    const dropdown=settings.getViewById<SelectionDropdown>('language-dropdown');tap(dropdown.trigger);await wait();
    check(dropdown.options.visibility==='visible','language dropdown opens');
    captureDiagnostics(settings,'led-sudoku-dropdown.png');
    tap(dropdown.options.getChildAt(1) as Button);check(game.preferences.language==='en' && game.snapshot().title==='LED Sudoku','English applied immediately');
    const skin=settings.getViewById<SelectionDropdown>('skin-dropdown'),originalBoard=s.state!.board.join();tap(skin.trigger);tap(skin.options.getChildAt(1) as Button);
    check(game.preferences.theme==='light-blue'&&settings.className==='light-blue'&&game.page.className==='light-blue','skin dropdown updates both page and settings immediately');
    check(s.state!.board.join()===originalBoard,'changing skin preserves puzzle progress');
    check(skin.trigger.text.includes('Sky blue'),'theme names follow selected language');
    const filter=settings.getViewById<Switch>('filter-candidates'),board=settings.getViewById<Switch>('show-candidates');
    board.checked=true;check(game.preferences.showCandidates,'candidate overlay enabled');
    filter.checked=false;check(!board.isEnabled&&!board.checked&&!game.preferences.showCandidates,'filter off disables dependent option');
    check(s.choices.length===9,'filter off allows all nine digits');
    filter.checked=true;board.checked=true;
    const manual=settings.getViewById<Switch>('manual-candidates'),beforeManual=JSON.stringify(s.state);
    manual.checked=true;
    check(game.preferences.manualCandidates&&!s.filterCandidates&&s.choices.length===9,'manual setting bypasses all automatic candidate filtering');
    check(!filter.isEnabled&&!filter.checked&&!board.isEnabled&&!board.checked,'manual setting disables dependent assistance controls');
    check(JSON.stringify(s.state)===beforeManual,'manual setting preserves current board and notebook');
    await wait();captureDiagnostics(settings,'led-sudoku-manual-settings.png');
    manual.checked=false;
    check(!game.preferences.manualCandidates&&s.filterCandidates&&filter.isEnabled&&filter.checked,'leaving manual mode restores previous filtering preference');
    board.checked=true;
    tap(dropdown.trigger);tap(dropdown.options.getChildAt(2) as Button);check(game.preferences.language==='ja' && game.snapshot().title==='LED 数独','Japanese applied immediately');
    tap(dropdown.trigger);tap(dropdown.options.getChildAt(1) as Button);await wait();captureDiagnostics(settings,'led-sudoku-settings.png');
    tap(settings.getViewById<Button>('preferences-done'));await wait();captureDiagnostics(game.page,'led-sudoku-english.png');
    const release=game.host?.pausePresentation();game.modal=true;
    const rules=showSettings(game.page,s.state!.puzzle.options,'en',game.preferences.theme);await wait();
    const rulesPage=game.page.modal as Page, help=rulesPage.getViewById<Button>('help-led'),tip=rulesPage.getViewById<GridLayout>('rule-tip');
    const touch=(action:string,x=0)=>help.getGestureObservers(GestureTypes.touch)?.forEach(o=>o.callback({action,getX:()=>x,getY:()=>0} as never));
    check(!!rulesPage.getViewById<Button>('help-littleKiller'),'little killer rule and help are available in native settings');
    check(!!rulesPage.getViewById<Button>('help-antiKing'),'anti-king rule and help are available in native settings');
    touch('down');check(tip.visibility==='visible','rule explanation appears on press');await wait();captureDiagnostics(rulesPage,'led-sudoku-rule-help.png');
    touch('up');check(tip.visibility==='collapse','rule explanation closes on release');touch('down');touch('move',30);check(tip.visibility==='collapse','rule explanation closes on scroll movement');touch('down');touch('cancel');check(tip.visibility==='collapse','rule explanation closes on cancelled touch');
    tap(rulesPage.getViewById<Button>('rules-cancel'));await rules;await wait();game.modal=false;release?.();
    game.applyPreferences({...game.preferences,language:'zh',theme:'dark',filterCandidates:true,showCandidates:false});
    const i = s.state!.puzzle.lights.findIndex(Boolean), v = s.state!.solution[i]; s.select(i); s.pencil = true; game.enter(v);
    check(!!(s.state!.crossed?.[i]! & 1<<(v-1)) && !s.state!.board[i], 'pencil crosses candidate');
    check(game.keys[v-1]!.strike.visibility==='visible' && game.keys[v-1]!.hit.isEnabled,'crossed key remains restorable');
    await wait();captureDiagnostics(game.page,'led-sudoku-crossed-notes.png');
    game.enter(v);check(s.state!.crossed?.[i]===0,'second tap restores candidate');game.enter(v);
    s.undo();game.render();check(s.state!.crossed?.[i]===0,'undo restores crossed candidate');game.enter(v); s.pencil = false; game.enter(v); check(s.state!.board[i] === v, 'candidate placement');
    s.undo(); check(!s.state!.board[i], 'undo'); game.enter(v); game.enter(0); check(!s.state!.board[i], 'erase');
    check(s.explain().length > 0, 'hint explanation');
    await game.flush(); const restored = await game.save.load(); check(restored && restored.board.join() === s.state!.board.join(), 'native save restore');
    const all = { ...DEFAULT_OPTIONS, diagonal: true, missing: true, killer: true, renban: true, consecutive: true, inequality: true, multiDiagonal: true, exclusion: true, parity: true };
    await game.newGame(all, 20260920); check(isSaveData(s.state), 'all variants generation');
    check(s.state!.puzzle.lineRule === 'ordered' && s.state!.puzzle.lines.every(path => { const values = path.map(i => s.state!.solution[i]!); const step = values[1]! - values[0]!; return Math.abs(step) === 1 && values.every((v,n) => !n || v - values[n-1]! === step); }), 'continuous lines ascend or descend by one');
    check((s.state!.puzzle.slants?.length ?? 0) >= 2 && s.state!.puzzle.exclusions!.length > 0, 'native variant data');
    check(search(s.state!.puzzle).count === 1, 'all variants uniqueness');
    s.answer(); game.commit('诊断：辅助完成'); check(s.done, 'complete'); check(!game.page.getViewById<Button>('more').isEnabled,'answer disabled on assisted completion'); s.undo(); game.commit('诊断：撤销'); check(!s.done, 'completion undo');
    await game.newGame({ ...all, led: false }, 77); check(s.state!.puzzle.lights.every(n=>!n), 'classic no cell LEDs'); check(s.state!.puzzle.exclusions!.every(e=>!e.mask), 'classic numeric exclusions');
    await game.newGame({ ...DEFAULT_OPTIONS, inequality:true, multiDiagonal:true, exclusion:true, parity:true }, 20260920);
    check(pruneImpliedInequalities(JSON.parse(JSON.stringify(s.state!.puzzle))) === 0, 'generated inequalities add candidate information');
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
    const antiKingStart=Date.now();await game.newGame({...DEFAULT_OPTIONS,antiKing:true,led:false,difficulty:'hard'},39);
    report('generation-timing',{name:'anti-king',seed:39,ms:Date.now()-antiKingStart});
    check(isSaveData(s.state)&&search(s.state!.puzzle).count===1,'anti-king saves and has a unique solution');
    check(s.state!.solution.every((v,i)=>diagonalNeighbors(i).every(j=>v!==s.state!.solution[j])),'anti-king diagonal neighbors never repeat');
    check(meetsChallenge(analyzeSingles(s.state!.puzzle)),'anti-king challenge resists singles');
    await wait();captureDiagnostics(game.page,'led-sudoku-antiking.png');
    const nonConsecutiveStart=Date.now();await game.newGame({...DEFAULT_OPTIONS,nonConsecutive:true,extraRegion:true,led:false,difficulty:'hard'},39);
    report('generation-timing',{name:'non-consecutive with extra regions',seed:39,ms:Date.now()-nonConsecutiveStart});
    check(isSaveData(s.state)&&search(s.state!.puzzle).count===1,'non-consecutive with extra regions has a valid unique solution');
    check(s.state!.puzzle.extraRegions?.length===2&&s.state!.solution.every((v,i)=>[i%9<8?i+1:-1,i+9].filter(j=>j>=0&&j<81).every(j=>Math.abs(v-s.state!.solution[j]!)!==1)),'non-consecutive orthogonal neighbors and two extra houses');
    check(meetsChallenge(analyzeSingles(s.state!.puzzle)),'non-consecutive challenge resists singles');
    const regionStart=Date.now();await game.newGame({...DEFAULT_OPTIONS,extraRegion:true,led:false},5);
    report('generation-timing',{name:'symmetric extra regions',seed:5,ms:Date.now()-regionStart});
    check(s.state!.puzzle.extraRegions?.length===4&&s.state!.puzzle.extraRegions.every(r=>r.length===9),'four nine-cell extra houses generated');
    check(isSaveData(s.state)&&search(s.state!.puzzle).count===1,'extra houses survive save validation and have one solution');
    check(s.state!.puzzle.extraRegions!.every(region=>new Set(region.map(i=>s.state!.solution[i])).size===9),'extra house solution digits are distinct');
    const littleStart=Date.now();await game.newGame({...DEFAULT_OPTIONS,littleKiller:true,led:false},39);
    report('generation-timing',{name:'little killer',seed:39,ms:Date.now()-littleStart});
    check(isSaveData(s.state)&&search(s.state!.puzzle).count===1,'little killer valid save and unique solution');
    check(!!s.state!.puzzle.littleKillers?.length&&s.state!.puzzle.littleKillers.every(c=>littleKillerPath(c).reduce((sum,i)=>sum+s.state!.solution[i]!,0)===c.sum),'little killer arrow totals match solution');
    const previousState=s.state!;
    const puzzle: Puzzle={version:1,seed:0,options:{...DEFAULT_OPTIONS,led:false,inequality:true},givens:hintFixture.givens.slice(),blocked:Array(81).fill(false),lights:Array(81).fill(0),cages:[],lines:[],dots:[],inequalities:hintFixture.inequalities.map(p=>[p[0]!,p[1]!])};
    const proof=search(puzzle,hintFixture.board,1);check(!!proof.solution,'screenshot fixture has a valid completion');
    try {
      s.restore({puzzle,board:hintFixture.board.slice(),solution:proof.solution!,notes:Array(81).fill(0),elapsed:0,assisted:false});game.render();game.openExplanation();await wait();
      check(game.lessonPanel.visibility==='visible'&&s.hint?.cell===10&&s.hint.steps.length===6,'screenshot opens six-step R2C2 explanation');
      check(!game.page.getViewById<Button>('lesson-previous').isEnabled,'first explanation step cannot move backward');
      captureDiagnostics(game.page,'led-sudoku-hint-start.png');
      const initial=s.state!.board.join();game.enter(9);check(s.state!.board.join()===initial,'explanation blocks accidental puzzle entry');
      tap(game.page.getViewById<Button>('lesson-next'));tap(game.page.getViewById<Button>('lesson-next'));await wait();captureDiagnostics(game.page,'led-sudoku-hint-inequality.png');
      tap(game.page.getViewById<Button>('lesson-previous'));tap(game.page.getViewById<Button>('lesson-next'));
      tap(game.page.getViewById<Button>('lesson-next'));tap(game.page.getViewById<Button>('lesson-next'));await wait();captureDiagnostics(game.page,'led-sudoku-hint-box.png');
      tap(game.page.getViewById<Button>('lesson-next'));await wait();captureDiagnostics(game.page,'led-sudoku-hint-conclusion.png');
      check(s.state!.board.join()===initial&&s.state!.notes.every(v=>!v),'all explanation steps preserve board and notes');
      tap(game.page.getViewById<Button>('lesson-next'));check(game.lessonPanel.visibility==='collapse'&&!game.modal,'last step returns to the puzzle');
    } finally { game.closeExplanation();s.restore(previousState);game.render(); }
    try {
      s.restore(structuredClone(eliminationFixture) as SaveData);game.render();const before=JSON.stringify(s.state);
      game.openExplanation();await wait();
      check(s.hint?.kind==='elimination'&&s.selected===38,'stalled puzzle highlights reducible cell');
      tap(game.page.getViewById<Button>('lesson-close'));check(JSON.stringify(s.state)===before,'closing candidate explanation preserves notes');
      for(let n=0;n<5;n++){
        game.openExplanation();check(s.hint?.kind==='elimination','next hint continues candidate reduction');
        tap(game.page.getViewById<Button>('lesson-next'));await wait();
        if(n===0)captureDiagnostics(game.page,'led-sudoku-hint-elimination.png');
        tap(game.page.getViewById<Button>('lesson-next'));tap(game.page.getViewById<Button>('lesson-next'));
        check(game.page.getViewById<Button>('lesson-next').text==='应用到笔记','elimination ends with explicit notebook action');
        tap(game.page.getViewById<Button>('lesson-next'));check(s.state!.deductionSteps===n+1&&!game.modal,'apply saves reduction and returns to puzzle');
      }
      check(s.state!.board.join()===eliminationFixture.board.join(),'candidate hints never autofill digits');
      check(s.state!.notes[8]===1<<5,'successive deductions leave one candidate');
      game.openExplanation();check(s.hint?.kind==='placement'&&s.hint.value===6,'deductions reveal the next placement');game.closeExplanation();
      check(s.undo()&&s.state!.deductionSteps===4,'undo restores previous candidate proof');
      await game.flush();
    } finally { game.closeExplanation();s.restore(previousState);game.render(); }
    try {
      const restored:unknown=structuredClone(sumFixture);if(!isSaveData(restored))throw Error('Invalid 45-rule fixture');
      s.restore(restored);game.render();const before=JSON.stringify(s.state),start=Date.now();game.openExplanation();
      report('advanced-hint-timing',{kind:'45-rule',ms:Date.now()-start});
      check(s.hint?.kind==='elimination'&&s.hint.eliminations.some(e=>e.cell===9&&e.digits.join()==='2,3'),'45-rule eliminates R2C1 candidates 2 and 3');
      check(s.hint?.steps.length===7&&s.hint.steps.some(step=>step.title.includes('45')),'45-rule opens a seven-step arithmetic explanation');
      for(let n=1;n<7;n++)tap(game.page.getViewById<Button>('lesson-next'));
      check(JSON.stringify(s.state)===before,'viewing sum proof preserves the player notebook');
      tap(game.page.getViewById<Button>('lesson-next'));check(!game.modal&&s.state!.board[9]===0,'sum proof applies candidates without filling');
      game.openExplanation();check(s.hint?.kind==='placement'&&s.hint.cell===9&&s.hint.value===8,'after sum proof next hint advances to R2C1 equals 8');game.closeExplanation();
      check(s.undo()&&JSON.stringify(s.state)===before,'sum notebook deduction can be undone exactly');
    } finally {game.closeExplanation();s.restore(previousState);game.render();}
    try {
      for(const [fixture,kind] of [[advancedFixture,'XV'],[chainFixture,'chain']] as const){
        const restored:unknown=structuredClone(fixture);if(!isSaveData(restored))throw Error('Invalid advanced hint fixture');s.restore(restored);game.render();const original=s.state!.board.join(),notes=s.state!.notes.join();
        const start=Date.now();game.openExplanation();report('advanced-hint-timing',{kind,ms:Date.now()-start});
        check(s.hint?.kind==='elimination',`${kind} explanation finds an elimination`);
        const hint=s.hint!,count=hint.steps.length;
        check(kind==='XV'?hint.steps[1]!.text.includes('(1, 4)'):hint.steps.some(step=>step.title==='发现矛盾'),`${kind} contains an explicit proof`);
        for(let n=1;n<count;n++)tap(game.page.getViewById<Button>('lesson-next'));
        check(s.state!.board.join()===original&&s.state!.notes.join()===notes,`${kind} viewing proof does not change progress`);
        check(game.page.getViewById<Button>('lesson-next').text==='应用到笔记',`${kind} final action records candidates`);
        tap(game.page.getViewById<Button>('lesson-next'));
        check(!game.modal&&s.state!.board.join()===original,`${kind} apply never autofills digits`);
        check(s.undo()&&s.state!.notes.join()===notes,`${kind} notebook action is reversible`);
      }
    } finally {game.closeExplanation();s.restore(previousState);game.render();}
    try {
      const manualFixture:unknown=structuredClone(advancedFixture);if(!isSaveData(manualFixture))throw Error('Invalid manual hint fixture');
      s.restore(manualFixture);game.render();game.openExplanation();
      check(s.hint?.cell===8,'manual hint starts at R1C9');game.closeExplanation();s.pencil=true;game.enter(2);
      game.openExplanation();check(s.hint?.cell===17&&s.hint.eliminations.length===1,'explain skips recorded R1C9 and selects pending R2C9');game.closeExplanation();game.enter(2);
      const before=JSON.stringify(s.state);game.openExplanation();
      check(s.hint?.kind==='elimination'&&s.hint.deductionSteps===1,'explain advances beyond manually recorded XV result');
      check(JSON.stringify(s.state)===before,'opening next explanation does not change notes');game.closeExplanation();
      check(s.applyHint()&&s.state!.deductionSteps===2,'apply after manual crosses saves the full proof prefix');
      check(s.undo()&&JSON.stringify(s.state)===before,'undo returns to manual crosses');
    } finally {game.closeExplanation();s.restore(previousState);game.render();}
    try {
      const fixture:unknown=structuredClone(noteSyncFixture);if(!isSaveData(fixture))throw Error('Invalid note sync fixture');
      s.restore(fixture);s.select(19);s.pencil=true;game.render();
      check(s.choices.join()==='1,8,9','R3C2 notes match current candidates 1/8/9');
      check([3,5].every(i=>!game.keys[i]!.hit.isEnabled&&game.keys[i]!.strike.visibility==='collapse'),'obsolete crossed 4/6 are filtered from the keypad');
      check([0,7].every(i=>game.keys[i]!.hit.isEnabled&&game.keys[i]!.strike.visibility==='visible'),'remaining manual crosses 1/8 are preserved');
    } finally {s.restore(previousState);game.render();}
    try {
      const near=structuredClone(previousState);near.board=near.solution.slice();near.notes=Array(81).fill(0);near.crossed=Array(81).fill(0);near.assisted=false;
      const last=near.puzzle.givens.findIndex((v,i)=>!v&&!near.puzzle.blocked[i]);near.board[last]=0;
      s.restore(near);s.select(last);game.render();game.enter(near.solution[last]!);
      check(s.done&&!s.state!.assisted,'natural completion remains unassisted');
      check(!game.page.getViewById<Button>('more').isEnabled&&game.snapshot().completionSweep,'answer disabled and sweep starts on final digit');
      report('completion-sweep-start',game.snapshot());
      tap(game.page.getViewById<Button>('more'));check(!game.modal,'completed answer handler does not open confirmation');
      await new Promise(resolve=>setTimeout(resolve,2500));
      check(!game.snapshot().completionSweep,'sweep stops after one bounded pass');
      game.render();check(!game.snapshot().completionSweep,'redraw does not replay sweep');
      s.undo();game.render();check(game.page.getViewById<Button>('more').isEnabled&&!game.snapshot().completionSweep,'undo restores answer button and clears sweep');
    } finally {s.restore(previousState);game.render();}
    game.message(`真机自动检查 ${checks} 项通过`); report('smoke-complete', { passed:true, checks, snapshot:game.snapshot() });
  } catch (error) { game.message(String(error)); report('smoke-failed', { passed:false, checks, error:String(error) }); }
}
