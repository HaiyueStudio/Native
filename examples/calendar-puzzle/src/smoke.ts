import { CalendarSolverClient } from '../../../../Games/games/calendar-puzzle/solver-client';
import type { CalendarSolverWorker } from '../../../../Games/games/calendar-puzzle/solver-client';
import type { HaiyueEngine } from '@haiyue/engine';
import type { GameSaveBackend } from '@haiyue/engine/save';
import type { CalendarPuzzleGame } from '../../../../Games/games/calendar-puzzle/CalendarPuzzleGame';
import { calendarViewport } from '../../../../Games/games/calendar-puzzle/viewport';
import { isCalendarPuzzleSaveData, type CalendarPuzzleSaveData } from '../../../../Games/games/calendar-puzzle/model';
import { SingleSlotGameSave } from '../../../../Games/games/save/SingleSlotGameSave';
import type { NativeTouchInput } from '../../../bridge/input/native-touch';
import { captureSurfaceFrame } from '../../../bridge/render/frame-capture';
import type { Canvas } from '@nativescript/canvas';
import solution from './victory-fixture.json';

/** Only CALENDAR_SMOKE uses this isolated near-complete board; production saves are untouched. */
export async function seedCalendarSmoke(backend: GameSaveBackend): Promise<void> {
  const save = new SingleSlotGameSave<CalendarPuzzleSaveData>({ gameId:'calendar-puzzle', name:'smoke', backend, validateData:isCalendarPuzzleSaveData });
  await save.saveNow({ year:2024, month:2, day:28, weekday:3, language:'zh', completedDates:[], starredDates:[], hintUsed:false, pieces:solution.map((p,i)=>({ ...p, x:0,y:0,layer:i,scale:1,placed:i!==9 })) });
}
export function installCalendarSmoke(engine: HaiyueEngine, game: CalendarPuzzleGame, input: NativeTouchInput,
  backend: GameSaveBackend, report: (event: string, data: unknown) => void, canvas: Canvas, cleanWin = false, requestFrame?: () => void,
  rendering?: () => { frames: number; scheduledCallbacks: number }): () => void {
  let frame=0, hintStarted=0;
  const checks:Array<{name:string;passed:boolean}>=[];
  const check=(name:string,passed:boolean)=>{checks.push({name,passed});report('smoke-check',{name,passed});};
  const capture=(name:string)=>{try{report('ui-capture',captureSurfaceFrame(canvas,name+'.png'));}catch(e){report('capture-error',{message:String(e)});}};
  const pointer=(action:'down'|'move'|'up',x:number,y:number)=>{const r=input.target.getBoundingClientRect(),v=calendarViewport(r.width,r.height);input.target.handle(action,[{id:9001,x:x*v.scale,y:y*v.scale}]);};
  const tap=(id:string)=>{const r=game.snapshot().ui[id]!;const p={id:9001,x:r.x+r.width/2,y:r.y+r.height/2};input.target.handle('down',[p]);input.target.handle('up',[p]);};
  const dayButton=(day:number)=>'calendarDay'+game.snapshot().history.cells.findIndex(c=>c?.day===day);
  const tick=()=>{
    // Only the frame-scripted portion pumps frames; subsequent async stress
    // requests rely on actual input/worker/animation demand to wake the engine.
    requestFrame?.();
    if (frame===105 && game.snapshot().hintBusy && performance.now()-hintStarted<9000) return;
    frame++;
    const s=game.snapshot(),b=s.board;
    if(frame===100&&!cleanWin){hintStarted=performance.now();tap('hint');}
    if(frame===106){check(cleanWin?'clean run has no hint assistance':'native worker finds a compatible final-piece hint',cleanWin?!s.hintUsed:s.hint?.piece===9&&s.hintCompatible&&!s.hintBusy&&s.hintUsed);capture('hint-target');}
    if(frame===125){check('near-complete fixture has nine legal pieces',s.placed===9&&s.occupied===43);const p=s.pieces[9]!;pointer('down',p.x+32*p.scale,p.y+32*p.scale);}
    if(frame===128)pointer('move',b.x+74+32,b.y+4*74+32);
    if(frame===130)pointer('up',b.x+74+32,b.y+4*74+32);
    if(frame===160){check('last native drag triggers victory',s.celebrating&&s.placed===10&&s.occupied===47);check('victory records the full date',s.completedDates.length===1&&s.completedDates[0]==='2024-02-28');capture('victory-particles');}
    if(frame===165)check(cleanWin?'unassisted completion earns a star':'assisted completion does not earn a star',s.starredDates.includes('2024-02-28')===cleanWin);
    if(frame===220)tap('victoryHistory');
    if(frame===230){check('victory action opens right calendar',s.historyOpen&&!s.celebrating);check('completed date is highlighted',s.history.cells.some(c=>c?.day===28&&c.completed));check('leap February includes 29 dates',s.history.cells.filter(Boolean).length===29);capture('history-zh');tap('nextYear');}
    if(frame===225)check('history star matches assistance',s.history.cells.find(c=>c?.day===28)?.starred===cleanWin);
    if(frame===240){check('year navigation removes non-leap day',s.history.year===2025&&s.history.cells.filter(Boolean).length===28);check('same month/day in another year is not marked',!s.history.cells.some(c=>c?.completed));tap('previousYear');}
    if(frame===250)tap(dayButton(29));
    if(frame===260){check('date choice derives weekday and resets board',s.year===2024&&s.month===2&&s.day===29&&s.weekday===4&&s.placed===0&&!s.historyOpen);check('switching puzzle preserves completion history',s.completedDates.length===1);tap('calendar');}
    if(frame===265)check('new date starts without assistance',!s.hintUsed);
    if(frame===270)tap('previousMonth');
    if(frame===280)tap('previousMonth');
    if(frame===290){check('month navigation crosses year',s.history.year===2023&&s.history.month===12);tap('calendarBack');}
    if(frame===300)tap('settings');
    if(frame===310)tap('en');
    if(frame===320){check('English settings',s.language==='en');tap('settingsCalendar');}
    if(frame===330){capture('history-en');tap('nextMonth');}
    if(frame===334){capture('history-six-weeks');tap('previousMonth');tap('settings');}
    if(frame===340)tap('ja');
    if(frame===350){check('Japanese settings',s.language==='ja');tap('settingsCalendar');}
    if(frame===360){capture('history-ja');tap('calendarBack');}
    if(frame===370)tap('settings');
    if(frame===380)tap('zh');
    if(frame===390)tap('done');
    if(frame===410){const p=s.pieces[0]!,c=p.cells[0]!;pointer('down',p.x+(c.x*74+32)*p.scale,p.y+(c.y*74+32)*p.scale);pointer('up',p.x+(c.x*74+32)*p.scale,p.y+(c.y*74+32)*p.scale);tap('rotate');}
    if(frame===412){check('rotate starts a visible transition',s.animating===1);capture('rotate-transition');}
    if(frame===450){check('rotation settles before next input',s.animating===0);tap('flip');}
    if(frame===453){check('flip starts a visible transition',s.animating===1);capture('flip-transition');}
    if(frame===490){check('flip settles before shuffle',s.animating===0);tap('shuffle');}
    if(frame===494){check('shuffle animates all ten pieces',s.animating===10);capture('shuffle-transition');}
    if(frame===550){
      const bank=s.audio.backend as {error:string|null;buffers:number};
      check('all eight native PCM cues decode',bank.error===null&&bank.buffers===8);
      check('all eight gameplay sound events reach native playback',['date','place','rotate','flip','shuffle','win','settings','back'].every(id=>(s.audio.played[id as keyof typeof s.audio.played]??0)>0));
      check('shuffle settles with a clear board',s.animating===0&&s.placed===0&&s.occupied===0);capture('toolbar-final');}
    if(frame===560){engine.off('after-update',tick);void(async()=>{
      await game.flushSave();const save=new SingleSlotGameSave<CalendarPuzzleSaveData>({gameId:'calendar-puzzle',name:'smoke',backend,validateData:isCalendarPuzzleSaveData});const data=await save.load();
      check('native save retains year, leap date and completion history',data?.year===2024&&data.day===29&&data.completedDates?.[0]==='2024-02-28');
      check('native save retains clean-completion stars',data?.starredDates?.includes('2024-02-28')===cleanWin);
      const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
      const idle=async()=>{await delay(50);const end=Date.now()+16000;while(game.snapshot().hintBusy||game.snapshot().animating){if(Date.now()>end)throw new Error('Hint stress timed out');await delay(40);}};
      // Finger jitter is expressed in screen DIP, matching iOS points and Android DIP.
      const scale=calendarViewport(input.target.getBoundingClientRect().width,input.target.getBoundingClientRect().height).scale;
      const anchor=()=>{const p=game.snapshot().pieces[0]!,c=p.cells[0]!;return {p,x:p.x+(c.x*74+32)*p.scale,y:p.y+(c.y*74+32)*p.scale};};
      await idle();
      const first=anchor(),rotation=first.p.rotation,rotateCues=game.snapshot().audio.played.rotate??0;
      pointer('down',first.x,first.y);
      check('tap press keeps the tray piece at its original size',game.snapshot().pieces[0]!.scale===first.p.scale);
      pointer('move',first.x+6/scale,first.y+4/scale);await delay(60);
      pointer('up',first.x+6/scale,first.y+4/scale);
      check('finger jitter stays a selection without moving the piece',game.snapshot().pieces[0]!.x===first.p.x&&game.snapshot().pieces[0]!.y===first.p.y&&game.snapshot().pieces[0]!.rotation===rotation);
      await delay(180);
      pointer('down',first.x+5/scale,first.y+2/scale);await delay(65);
      pointer('move',first.x+10/scale,first.y+5/scale);
      pointer('up',first.x+10/scale,first.y+5/scale);
      check('jittery second tap rotates the same piece once',game.snapshot().pieces[0]!.rotation===(rotation+1)%4&&(game.snapshot().audio.played.rotate??0)===rotateCues+1);
      check('double tap starts the rotation animation',game.snapshot().animating===1);
      await idle();
      check('double tap rotation animation settles',game.snapshot().animating===0);
      await delay(450);
      const held=anchor();pointer('down',held.x,held.y);await delay(560);pointer('up',held.x,held.y);
      await delay(90);pointer('down',held.x,held.y);pointer('up',held.x,held.y);
      check('long press followed by a tap does not rotate',game.snapshot().pieces[0]!.rotation===held.p.rotation);
      const dragged=anchor(),places=game.snapshot().audio.played.place??0;
      pointer('down',dragged.x,dragged.y);pointer('move',dragged.x+24/scale,dragged.y);
      check('crossing drag slop enlarges the piece for placement',game.snapshot().pieces[0]!.scale===1);
      pointer('move',dragged.x,dragged.y);pointer('up',dragged.x,dragged.y);
      check('drag returning to its origin stays a drag without rotation',game.snapshot().pieces[0]!.rotation===dragged.p.rotation&&(game.snapshot().audio.played.place??0)===places+1);
      tap('shuffle');await idle();
      // Exercise the GUI and game revision/cancellation path as well as the solver.
      for(let i=0;i<24;i++) {
        await idle();
        tap('hint');await idle();
        check(`repeat hint ${i+1} stays available`,!!game.snapshot().hint&&game.snapshot().hintUsed);
        if(i%3===0) { tap('rotate');await idle(); }
        if(i%3===1) { tap('flip');await idle(); }
        if(i%3===2) {
          const state=game.snapshot(),index=((state.hint?.piece??0)+1)%state.pieces.length;
          const p=state.pieces[index]!,c=p.cells[0]!;
          const x=p.x+(c.x*74+32)*p.scale,y=p.y+(c.y*74+32)*p.scale;
          pointer('down',x,y);pointer('move',x+8,y+8);pointer('up',x+8,y+8);
        }
        // Cancel while solving and request again; a stale reply must not win.
        tap('hint');const p=game.snapshot().pieces[9]!,c=p.cells[0]!;
        const x=p.x+(c.x*74+32)*p.scale,y=p.y+(c.y*74+32)*p.scale;
        pointer('down',x,y);pointer('up',x,y);await idle();tap('hint');await idle();
        check(`hint ${i+1} recovers after moving another piece`,!!game.snapshot().hint);
      }
      // Recreating a scene or recovering an error can still load a new worker.
      for(let i=0;i<6;i++) {
        const client=new CalendarSolverClient(()=>new Worker('./solver.worker') as unknown as CalendarSolverWorker);
        try {const result=await client.solve({month:9,day:20,weekday:0,fixed:[]});check(`worker reload ${i+1}`,result?.status==='solved');}
        finally {client.dispose();}
        await delay(50);
      }
      if (rendering) {
        const rests = async (name: string) => {
          await delay(1500);
          const before = rendering(); await delay(800); const after = rendering();
          check(name, after.frames === before.frames && after.scheduledCallbacks === 0);
          report('idle-measurement', { name, before, after, observedMs: 800 });
        };
        await rests('stationary selection and hint stop all frame callbacks');
        let before = rendering().frames;
        tap('settings'); await delay(120);
        check('settings wakes from idle and opens', game.snapshot().settingsOpen && rendering().frames > before);
        tap('ja'); await delay(100); check('language change renders after queued GUI input', game.snapshot().language === 'ja');
        tap('zh'); tap('done'); await delay(120);
        await rests('settings close returns to zero idle frames');
        const pick = anchor();
        pointer('down',pick.x,pick.y); pointer('up',pick.x,pick.y); await delay(1000);
        before=rendering().frames; const rotation=game.snapshot().pieces[0]!.rotation;
        tap('rotate'); await delay(400);
        check('rotation wakes and finishes from idle', rendering().frames > before && game.snapshot().pieces[0]!.rotation === (rotation+1)%4 && game.snapshot().animating===0);
        await rests('rotation completion stops rendering');
        const held=anchor(); pointer('down',held.x,held.y); await delay(1200);
        const heldFrames=rendering().frames; await delay(500);
        check('holding a stationary finger does not keep rendering',rendering().frames===heldFrames);
        pointer('move',held.x+32/scale,held.y+18/scale);await delay(60);pointer('up',held.x+32/scale,held.y+18/scale);await delay(120);
        check('moving a held finger wakes the board and release completes',rendering().frames>heldFrames&&!game.snapshot().dragging);
        before=rendering().frames;tap('hint');await idle();await delay(100);
        check('async hint reply wakes rendering and becomes visible',!!game.snapshot().hint&&rendering().frames>before);
        await rests('async hint animation settles without a polling render loop');
        before=rendering().frames;
        canvas.notify({eventName:'layoutChanged',object:canvas});await delay(120);
        check('native layout event redraws a sleeping surface',rendering().frames>before);
        await rests('layout refresh settles back to idle');
      }
      capture('hint-stress-final');
      report('smoke-complete',{passed:checks.every(c=>c.passed),checks});
    })().catch(e=>report('smoke-error',{message:String(e)}));}
  };
  engine.on('after-update',tick);return()=>engine.off('after-update',tick);
}
