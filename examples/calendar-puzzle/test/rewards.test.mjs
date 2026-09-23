import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(file) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:()=>({}),Date,Error});
  return exports;
}
const { RewardController }=load('../../../bridge/rewards/controller.ts');
const { PresentationPause }=load('../../../bridge/lifecycle/presentation-pause.ts');
function fixture() {
  let data=null, now=new Date(2026,8,20), paid=false, fail=false, pauses=0, resumes=0, calls=0;
  let show=async earned=>{earned();};
  const options={dailyFree:1,dailyAds:2,storage:{read:()=>data,write:value=>{if(fail)throw Error('disk');data=value;}},
    gateway:{show:(earned,presentation)=>{calls++;return show(earned,presentation);},privacy:async()=>{},privacyRequired:()=>false,dispose(){}},
    entitled:()=>paid,now:()=>now,pause:()=>{pauses++;return()=>{resumes++;};}};
  const c=new RewardController(options);
  return {c,options,setShow:f=>{show=f;},date:d=>{now=d;},paid:v=>{paid=v;},fail:()=>{fail=true;},info:()=>({data:JSON.parse(data??'null'),pauses,resumes,calls})};
}
test('daily free hint is durable and repeat result is free; no solver success means no debit',()=>{
  const f=fixture(); assert.equal(f.c.snapshot().free,1);
  assert.equal(f.c.consume('date:piece0'),true);assert.equal(f.c.consume('date:piece0'),true);
  assert.equal(f.c.consume('date:piece1'),false);
  const reload=new RewardController(f.options);assert.equal(reload.snapshot().free,0);assert.equal(reload.consume('date:piece0'),true);
});
test('daily rollover retains earned credits and backwards clock cannot refill',async()=>{
  const f=fixture();f.c.consume('a');await f.c.watch();
  f.date(new Date(2026,8,21));assert.equal(f.c.snapshot().free,1);assert.equal(f.c.snapshot().credits,1);assert.equal(f.c.snapshot().adsRemaining,2);
  f.c.consume('b');f.date(new Date(2026,8,20));assert.equal(f.c.snapshot().free,0);
});
test('reward callback is immediately persisted, duplicates ignored, daily cap enforced',async()=>{
  const f=fixture();f.setShow(async earn=>{earn();earn();assert.equal(new RewardController(f.options).snapshot().credits,1);});
  await f.c.watch();assert.equal(f.c.snapshot().credits,1);
  f.setShow(async earn=>{earn();earn();});await f.c.watch();await f.c.watch();
  assert.equal(f.c.snapshot().credits,2);assert.equal(f.c.snapshot().phase,'limit');assert.equal(f.info().calls,2);
});
test('cancel, offline and no-fill do not grant or consume; pause always released',async()=>{
  const f=fixture();f.setShow(async()=>{});await f.c.watch();assert.equal(f.c.snapshot().phase,'cancelled');
  for(const reason of ['offline','unavailable','error']){f.setShow(async()=>{throw Error(reason);});await f.c.watch();assert.equal(f.c.snapshot().phase,reason);}
  assert.equal(f.c.snapshot().credits,0);assert.equal(f.c.snapshot().adsRemaining,2);assert.equal(f.info().pauses,f.info().resumes);
});
test('simultaneous watch taps and callbacks after dismissal cannot mint rewards',async()=>{
  const f=fixture();let finish,earn;
  f.setShow(callback=>new Promise(resolve=>{earn=callback;finish=resolve;}));
  const pending=f.c.watch();await f.c.watch();assert.equal(f.info().calls,1);
  earn();assert.equal(f.c.snapshot().credits,1);finish();await pending;earn();assert.equal(f.c.snapshot().credits,1);
});
test('network loading keeps rendering active and pauses only for ready native surfaces',async()=>{
  const f=fixture();let loaded,finish,hooks;
  f.setShow(async(earned,presentation)=>{
    hooks=presentation;await new Promise(resolve=>{loaded=resolve;});
    assert.equal(await presentation.prepare(),true);
    await new Promise(resolve=>{finish=resolve;});
  });
  const pending=f.c.watch();assert.equal(f.c.snapshot().operation,'ad');
  assert.equal(f.c.snapshot().busy,true);assert.equal(f.c.snapshot().presenting,false);assert.equal(f.info().pauses,0);
  loaded();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.c.snapshot().presenting,true);assert.equal(f.info().pauses,1);
  hooks.closed();assert.equal(f.c.snapshot().presenting,false);assert.equal(f.c.snapshot().busy,true);assert.equal(f.info().resumes,1);
  finish();await pending;assert.equal(f.c.snapshot().busy,false);assert.equal(f.info().resumes,1);
});
test('paid users have unlimited hints without SDK requests; revocation preserves free allowance',async()=>{
  const f=fixture();f.paid(true);for(let i=0;i<20;i++)assert.equal(f.c.consume(String(i)),true);
  await f.c.watch();assert.equal(f.info().calls,0);f.paid(false);assert.equal(f.c.snapshot().free,1);
});
test('storage errors and invalid persisted state fail closed without silently resetting',()=>{
  const f=fixture();f.fail();assert.equal(f.c.consume('a'),false);assert.equal(f.c.snapshot().free,0);assert.equal(f.c.snapshot().phase,'error');
  const c=new RewardController({...f.options,storage:{read:()=>'{broken',write(){}}});assert.equal(c.snapshot().free,0);assert.equal(c.consume('x'),false);
});
test('disposing during an earned ad keeps the reward durable and releases the pause once',async()=>{
  const f=fixture();let finish,earn;f.setShow(async(cb,presentation)=>{await presentation.prepare();await new Promise(resolve=>{earn=cb;finish=resolve;});});
  const run=f.c.watch();await new Promise(resolve=>setImmediate(resolve));f.c.dispose();earn();finish();await run;
  assert.equal(new RewardController(f.options).snapshot().credits,1);assert.equal(f.info().resumes,1);
});
test('OS resume never resumes behind an ad; nested locks and duplicate release are safe',()=>{
  const events=[];const gate=new PresentationPause(()=>events.push('stop'),()=>events.push('start'));
  const release=gate.acquire(),second=gate.acquire();gate.setBackground(true);gate.setBackground(false);
  assert.deepEqual(events,['stop']);release();release();assert.deepEqual(events,['stop']);second();assert.deepEqual(events,['stop','start']);
  const third=gate.acquire();gate.setBackground(true);third();assert.deepEqual(events,['stop','start','stop']);gate.setBackground(false);assert.equal(events.at(-1),'start');
});
test('SDK loads before presentation preparation and disposal releases its late token',async()=>{
  const f=fixture();let prepare,returned=0,shown=false;
  f.options.pause=()=>new Promise(resolve=>{prepare=resolve;});
  f.setShow(async(earn,presentation)=>{shown=await presentation.prepare();});
  const watching=f.c.watch();assert.equal(f.c.snapshot().busy,true);assert.equal(f.info().calls,1);
  f.c.dispose();prepare(()=>{returned++;});await watching;
  assert.equal(shown,false);assert.equal(returned,1);
});
test('presentation failure unlocks the UI without consuming an ad allowance',async()=>{
  const f=fixture();f.options.pause=()=>{throw Error('presentation failed');};
  f.setShow(async(earn,presentation)=>{await presentation.prepare();});await f.c.watch();
  assert.equal(f.c.snapshot().busy,false);assert.equal(f.c.snapshot().phase,'error');assert.equal(f.c.snapshot().adsRemaining,2);
});

test('slow startup consent refresh keeps input and hints available until a form is required',async()=>{
  const f=fixture();let finish,calls=0,present;
  f.options.gateway.initialize=show=>{calls++;present=show;return new Promise(resolve=>{finish=resolve;});};
  const first=f.c.initialize(),second=f.c.initialize();assert.equal(first,second);
  assert.equal(f.c.snapshot().busy,false);assert.equal(f.info().pauses,0);
  assert.equal(f.c.consume('during-startup'),true);assert.equal(f.info().calls,0);
  finish();await first;assert.equal(calls,1);assert.equal(present,true);
  assert.equal(f.c.snapshot().busy,false);assert.equal(f.c.snapshot().free,0);
  assert.equal(f.c.snapshot().credits,0);assert.equal(f.info().pauses,f.info().resumes);
});
test('network prerequisites are loading from construction and failed initialization clears them',async()=>{
  const f=fixture();let reject;
  const c=new RewardController({...f.options,gateway:{...f.options.gateway,initialize:()=>new Promise((resolve,fail)=>{reject=fail;})}});
  assert.equal(c.snapshot().initializing,true);assert.equal(c.snapshot().busy,false);
  const pending=c.initialize();reject(Error('offline'));await pending;
  assert.equal(c.snapshot().initializing,false);assert.equal(c.snapshot().busy,false);assert.equal(f.info().pauses,0);
});
test('required startup form pauses only after refresh and retains the lock across OS resume',async()=>{
  const f=fixture();let ready,finish;const events=[];
  const gate=new PresentationPause(()=>events.push('suspend'),()=>events.push('resume'));
  f.options.pause=()=>gate.acquire();
  f.options.gateway.initialize=async(show,beforePresent)=>{
    await new Promise(resolve=>{ready=resolve;});
    assert.equal(await beforePresent(),true);
    await new Promise(resolve=>{finish=resolve;});
  };
  const pending=f.c.initialize();assert.equal(f.c.snapshot().busy,false);assert.deepEqual(events,[]);
  ready();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.c.snapshot().busy,true);assert.deepEqual(events,['suspend']);
  gate.setBackground(true);gate.setBackground(false);assert.deepEqual(events,['suspend']);
  finish();await pending;assert.equal(f.c.snapshot().busy,false);assert.deepEqual(events,['suspend','resume']);
});
test('startup completion cannot release an explicit ad pause or clear its busy state',async()=>{
  const f=fixture();let refresh,finish,before;
  f.options.gateway.initialize=async(show,beforePresent)=>{
    await new Promise(resolve=>{refresh=resolve;});before=await beforePresent();
  };
  const startup=f.c.initialize();f.setShow(async(earn,presentation)=>{await presentation.prepare();await new Promise(resolve=>{finish=resolve;});});
  const ad=f.c.watch();await new Promise(resolve=>setImmediate(resolve));refresh();await startup;
  assert.equal(before,false);assert.equal(f.c.snapshot().busy,true);assert.equal(f.info().resumes,0);
  finish();await ad;assert.equal(f.c.snapshot().busy,false);assert.equal(f.info().resumes,1);
});
test('disposal during startup form preparation releases the late pause and skips presentation',async()=>{
  const f=fixture();let prepare,allowed;
  f.options.pause=()=>new Promise(resolve=>{prepare=resolve;});
  f.options.gateway.initialize=async(show,beforePresent)=>{allowed=await beforePresent();};
  const pending=f.c.initialize();f.c.dispose();let releases=0;
  prepare(()=>releases++);await pending;assert.equal(allowed,false);assert.equal(releases,1);
});
test('startup presentation failure releases busy state without spending allowances',async()=>{
  const f=fixture();f.options.pause=()=>{throw Error('presentation failed');};
  f.options.gateway.initialize=async(show,beforePresent)=>{await beforePresent();};
  await f.c.initialize();assert.equal(f.c.snapshot().busy,false);assert.equal(f.c.snapshot().free,1);
});
test('paid startup refreshes privacy without showing consent and failed updates leave play available',async()=>{
  const f=fixture();f.paid(true);let present;
  f.options.gateway.initialize=async show=>{present=show;throw Error('offline');};
  await f.c.initialize();assert.equal(present,false);assert.equal(f.c.snapshot().busy,false);
  assert.equal(f.c.snapshot().phase,'ready');assert.equal(f.info().calls,0);
  assert.equal(f.info().pauses,0);
  f.paid(false);assert.equal(f.c.consume('after-offline-startup'),true);
  assert.equal(f.info().pauses,f.info().resumes);
});
test('privacy changes refresh the entry requirement without spending a reward',async()=>{
  const f=fixture();let required=true;f.options.gateway.privacyRequired=()=>required;
  f.options.gateway.privacy=async()=>{required=false;};await f.c.privacy();
  assert.equal(f.c.snapshot().privacyRequired,false);assert.equal(f.c.snapshot().free,1);
  assert.equal(f.c.snapshot().adsRemaining,2);assert.equal(f.c.snapshot().busy,false);
});

test('unused daily hints expire; ad credits accumulate across days, restarts and free-first spending', async () => {
  const f = fixture();
  await f.c.watch(); await f.c.watch(); // Two credits, today's free hint untouched.
  f.date(new Date(2026, 8, 21)); f.c.refresh();
  assert.equal(f.c.snapshot().free, 1); assert.equal(f.c.snapshot().credits, 2);
  await f.c.watch(); // Accumulate another day's reward.
  f.date(new Date(2026, 8, 28)); // Several unused free days must not accumulate.
  const reload = new RewardController(f.options);
  assert.equal(reload.snapshot().free, 1); assert.equal(reload.snapshot().credits, 3);
  assert.equal(reload.consume('first'), true);
  assert.equal(reload.snapshot().free, 0); assert.equal(reload.snapshot().credits, 3);
  assert.equal(reload.consume('second'), true);
  assert.equal(reload.snapshot().credits, 2);
  const secondReload = new RewardController(f.options);
  assert.equal(secondReload.snapshot().free, 0); assert.equal(secondReload.snapshot().credits, 2);
  f.date(new Date(2026, 9, 1)); secondReload.refresh();
  assert.equal(secondReload.snapshot().free, 1); assert.equal(secondReload.snapshot().credits, 2);
});
