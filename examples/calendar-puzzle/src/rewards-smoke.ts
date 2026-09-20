import { CalendarSolverClient, type CalendarSolverWorker } from '../../../../Games/games/calendar-puzzle/solver-client';
import type { CalendarPuzzleGame } from '../../../../Games/games/calendar-puzzle/CalendarPuzzleGame';
import type { NativeTouchInput } from '../../../bridge/input/native-touch';
import { calendarViewport } from '../../../../Games/games/calendar-puzzle/viewport';
import type { Canvas } from '@nativescript/canvas';
import { captureSurfaceFrame } from '../../../bridge/render/frame-capture';

/** Debug-only isolated wallet/save; optionally requests an official demo ad. Never buys or clicks ads. */
export function installRewardsSmoke(game:CalendarPuzzleGame,input:NativeTouchInput,canvas:Canvas,
  report:(event:string,data:unknown)=>void,requestFrame:()=>void,realAd:boolean):()=>void {
  let disposed=false;
  const checks:Array<{name:string;passed:boolean}>=[];
  const delay=async(ms=220)=>{await new Promise(resolve=>setTimeout(resolve,ms));if(disposed)throw Error('disposed');};
  const check=(name:string,passed:boolean)=>{checks.push({name,passed});report('reward-check',{name,passed});};
  const tap=(id:string)=>{
    const r=game.snapshot().ui[id]!;const p={id:9201,x:r.x+r.width/2,y:r.y+r.height/2};
    input.target.handle('down',[p]);input.target.handle('up',[p]);requestFrame();
  };
  const idle=async()=>{await delay();const deadline=Date.now()+12000;while(game.snapshot().hintBusy&&Date.now()<deadline)await delay(100);};
  void(async()=>{
    await delay(2500);
    const deadline=Date.now()+45000;while(game.snapshot().purchases?.busy&&Date.now()<deadline)await delay();
    check('free daily allowance starts at one',game.snapshot().rewards?.free===1);
    tap('hint');await idle();
    check('free hint shows a useful placement and debits once',!!game.snapshot().hint&&game.snapshot().hintUsed&&game.snapshot().rewards?.free===0);
    const hinted=game.snapshot().hint?.piece;
    tap('hint');await idle();check('repeated hint is free',!!game.snapshot().hint&&game.snapshot().rewards?.free===0&&!game.snapshot().rewardOpen);
    const p=game.snapshot().pieces[hinted===0?1:0]!,cell=p.cells[0]!;
    const view=input.target.getBoundingClientRect(),scale=calendarViewport(view.width,view.height).scale;
    const point={id:9201,x:(p.x+(cell.x*74+32)*p.scale)*scale,y:(p.y+(cell.y*74+32)*p.scale)*scale};
    input.target.handle('down',[point]);input.target.handle('up',[point]);requestFrame();await delay();
    const runs=game.snapshot().solver.workerRuns, openedAt=performance.now();
    tap('hint');await idle();
    check('exhausted allowance does not start another solve',game.snapshot().solver.workerRuns===runs&&!game.snapshot().hintBusy);
    report('hint-quota-gate',{elapsedMs:performance.now()-openedAt,solver:game.snapshot().solver});
    check('extra hint opens optional reward choices',game.snapshot().rewardOpen&&!game.snapshot().hint&&game.snapshot().rewards?.adsRemaining===2);
    report('reward-capture',captureSurfaceFrame(canvas,'reward-choices.png'));
    tap('rewardClose');await delay();check('declining ads returns to puzzle',!game.snapshot().rewardOpen);
    tap('settings');await delay();
    for(const language of ['fr','de','es','en','ja','zh']){
      tap('languageSelect');await delay();const menu=game.snapshot().languageMenu!;
      const p={id:9201,x:menu.popup.x+menu.popup.width/2,y:menu.popup.y+(menu.values.indexOf(language as any)+.5)*menu.optionHeight-menu.scrollY};
      input.target.handle('down',[p]);input.target.handle('up',[p]);requestFrame();await delay();
      tap('done');await delay();tap('hint');await idle();
      check(`${language} reward panel`,game.snapshot().rewardOpen&&game.snapshot().language===language);
      report('reward-capture',captureSurfaceFrame(canvas,'reward-'+language+'.png'));
      tap('rewardClose');await delay();tap('settings');await delay();
    }
    tap('done');await delay();
    if(realAd){
      tap('hint');await idle();tap('rewardWatch');await delay();
      report('reward-loading-capture',captureSurfaceFrame(canvas,'reward-loading.png'));
      const end=Date.now()+150000;while(game.snapshot().rewards?.busy&&Date.now()<end)await delay(500);
      report('reward-ad-result',game.snapshot().rewards);
      report('reward-capture',captureSurfaceFrame(canvas,'reward-ad-result.png'));
      if(game.snapshot().rewards?.credits){tap('rewardUse');await idle();check('earned hint used successfully',!!game.snapshot().hint&&game.snapshot().rewards?.credits===0);}
      else {
        check('unsuccessful ad does not consume daily quota',!game.snapshot().rewards?.busy&&game.snapshot().rewards?.credits===0&&game.snapshot().rewards?.adsRemaining===2);
        tap('rewardClose');await delay();check('interaction restored after native ad flow',!game.snapshot().rewardOpen);
      }
    }
    const solver=new CalendarSolverClient(()=>new Worker('./solver.worker') as unknown as CalendarSolverWorker);
    try {
      const today={month:9,day:20,weekday:0,fixed:[]};
      const start=performance.now(),full=await solver.solve(today);
      report('hint-worker-timing',{kind:'first-worker-start-and-solve',ms:performance.now()-start,nodes:full?.nodes});
      if(full?.status!=='solved')throw Error('Hint cache fixture did not solve');
      const cachedStart=performance.now();
      for(let count=1;count<=full.solution.length;count++) {
        const result=await solver.solve({...today,fixed:full.solution.slice(0,count)});
        check(`cached continuation ${count}`,result?.status==='solved'&&result.compatible&&result.nodes===0);
      }
      report('hint-worker-timing',{kind:'ten-cached-continuations',ms:performance.now()-cachedStart,solver:solver.snapshot()});
      check('all ten placements use a single native worker request',solver.snapshot().workerRuns===1);
      for(const date of [{month:7,day:25,weekday:1},{month:3,day:10,weekday:4}]) {
        const start=performance.now(),result=await solver.solve({...date,fixed:[]});
        check(`fresh solve ${date.month}/${date.day}`,result?.status==='solved');
        report('hint-worker-timing',{kind:'fresh-search',date,ms:performance.now()-start,nodes:result?.nodes});
      }
    } finally {solver.dispose();}
    report('reward-smoke-complete',{passed:checks.every(c=>c.passed),checks,state:game.snapshot().rewards});
  })().catch(error=>{if(!disposed)report('reward-smoke-error',{error:String(error),checks});});
  return()=>{disposed=true;};
}
