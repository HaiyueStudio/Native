import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context); } });
const { sudokuLayout } = await import('../../../../Games/games/led-sudoku/gui-layout.ts');
const { MobileSession } = await import('../src/model.ts');
const { NativeGenerator } = await import('../src/generator.ts');
const { generate, DEFAULT_OPTIONS, isSaveData } = await import('../../../../Games/games/led-sudoku/rules.ts');
const { paintBoard } = await import('../../../../Games/games/led-sudoku/board-painter.ts');

test('shared engine GUI keeps nine large targets within portrait phones', () => {
  for (const [width,height] of [[320,568],[360,800],[390,844],[412,915],[393,873],[430,932]]) {
    const l=sudokuLayout(width,height);
    assert.equal(l.board.width,l.board.height);assert(l.board.width<=width-24);
    assert(l.tools>=44);assert(l.keyHeight-6>=44);assert(l.bottom+44<=height);
    assert(l.keyTop+3*l.keyHeight-6<=l.bottom);
  }
});
test('native session uses the same rule filters and immutable notes/undo/erase', () => {
  const m = new MobileSession(), g = generate(DEFAULT_OPTIONS,20260920); m.start(g);
  const i = g.puzzle.lights.findIndex(Boolean), v=g.solution[i]; m.select(i);
  m.pencil=true; assert(m.input(v)); assert(!m.state.board[i]); assert(m.state.crossed[i] & 1<<(v-1));
  m.pencil=false; assert(m.input(v)); assert.equal(m.state.board[i],v); assert.equal(m.state.notes[i],0);
  assert(m.undo()); assert(!m.state.board[i]); assert(m.state.crossed[i] & 1<<(v-1)); assert(m.input(v)); assert(m.input(0));
  assert(isSaveData(m.state)); assert(m.explain().length);
  m.answer(); assert(m.done); assert(m.state.assisted); assert(m.undo()); assert(!m.done); assert(m.state.assisted);
});
test('native restore preserves options, time, notes, and black-cell protection', () => {
  const opts={...DEFAULT_OPTIONS,led:false,missing:true,inequality:true,multiDiagonal:true,exclusion:true,parity:true};
  const m=new MobileSession(); m.start(generate(opts,7)); m.state.elapsed=147;
  const before=m.selected; m.select(m.state.puzzle.blocked.findIndex(Boolean)); assert.equal(m.selected,before);
  const n=new MobileSession(); n.restore(structuredClone(m.state)); assert.equal(n.state.elapsed,147); assert.deepEqual(n.state.puzzle.options,opts); assert(isSaveData(n.state));
});
test('persistent worker cancels old results, settles failures, and terminates on dispose', async () => {
  const workers=[];
  const client=new NativeGenerator(()=>{const w={postMessage(data){this.last=data;},terminate(){this.terminated=true;}};workers.push(w);return w;});
  const first=client.generate(DEFAULT_OPTIONS,1), second=client.generate(DEFAULT_OPTIONS,2);
  assert.equal(await first,null); assert.equal(workers.length,1);
  workers[0].onmessage({data:{id:1,result:{old:true}}});
  const expected={puzzle:{},solution:[]}; workers[0].onmessage({data:{id:2,result:expected}}); assert.deepEqual(await second,expected);
  const failed=client.generate(DEFAULT_OPTIONS,3); workers[0].onerror(new Error('test')); await assert.rejects(failed,/线程异常/); assert(workers[0].terminated);
  const final=client.generate(DEFAULT_OPTIONS,4); client.dispose(); assert.equal(await final,null); assert(workers[1].terminated);
});
test('shared board painter draws seven dark tubes for every playable empty LED cell', () => {
  let fills=0;
  const context=new Proxy({fill(){fills++;}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  const p={version:1,seed:1,options:{...DEFAULT_OPTIONS},givens:Array(81).fill(0),lights:Array(81).fill(0),blocked:Array(81).fill(false),cages:[],lines:[],dots:[]};
  const state={puzzle:p,board:p.givens.slice(),notes:Array(81).fill(0),selected:-1,hint:-1,solution:Array(81).fill(1)};
  paintBoard(context,state); assert.equal(fills,81*7);
  fills=0;p.blocked[0]=true;paintBoard(context,state);assert.equal(fills,80*7);
  fills=0;p.options.led=false;paintBoard(context,state);assert.equal(fills,0);
});

test('iPhone GUI fits measured safe content without including the home indicator', () => {
  for (const [width,height] of [[430,839],[393,759],[390,763],[428,845],[375,559]]) {
    const l=sudokuLayout(width,height);
    assert(l.bottom+44<=height);assert(l.board.width<=width-24);assert(l.keyHeight-6>=44);
  }
});

test('candidate hints apply progressively, survive restore and support exact undo', () => {
  const fixture=JSON.parse(readFileSync(new URL('../../../../Games/games/led-sudoku/evidence/hints/elimination.json',import.meta.url),'utf8'));
  const m=new MobileSession();m.restore(fixture);const initial=structuredClone(m.state);
  m.explain();assert.equal(m.hint.kind,'elimination');assert.deepEqual(m.state,initial);assert.equal(m.selected,38);
  assert(m.applyHint());assert(m.pencil);assert.equal(m.state.deductionSteps,1);assert(m.state.notes[38]);const applied=structuredClone(m.state);
  assert(m.undo());assert.deepEqual(m.state,{...initial,deductionSteps:0});m.explain();assert(m.applyHint());assert.deepEqual(m.state,applied);
  const reloaded=new MobileSession();reloaded.restore(JSON.parse(JSON.stringify(m.state)));reloaded.explain();assert.equal(reloaded.hint.kind,'elimination');assert.notEqual(reloaded.hint.cell,38);
  assert(reloaded.applyHint());assert.equal(reloaded.state.deductionSteps,2);assert(reloaded.undo());assert.equal(reloaded.state.deductionSteps,1);
  for(let i=1;i<5;i++){m.explain();assert(m.applyHint());}m.explain();assert.equal(m.hint.kind,'placement');assert.equal(m.hint.value,6);assert.equal(m.hint.cell,8);assert(!m.applyHint());
});

test('hint eliminations keep their undo steps across a save and reload', () => {
  const fixture=JSON.parse(readFileSync(new URL('../../../../Games/games/led-sudoku/evidence/hints/elimination.json',import.meta.url),'utf8'));
  const m=new MobileSession();m.restore(fixture);const before=structuredClone(m.state);
  m.explain();assert(m.applyHint());const first=structuredClone(m.state);
  m.explain();assert(m.applyHint());assert.equal(m.history.length,2);
  const saved=m.snapshot();assert(isSaveData(saved));
  const resumed=new MobileSession();resumed.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(resumed.history.length,2);assert(resumed.undo());assert.deepEqual(resumed.state,first);
  const resumedAgain=new MobileSession();resumedAgain.restore(JSON.parse(JSON.stringify(resumed.snapshot())));
  assert(resumedAgain.undo());assert.deepEqual(resumedAgain.state,{...before,deductionSteps:0});assert(!resumedAgain.undo());
  m.start(generate(DEFAULT_OPTIONS,39));assert.equal(m.history.length,0);
});

test('missing XV and implication chains use the native explanation/notes/undo flow',()=>{
 for(const file of ['missing-xv-stalled.json','missing-xv-chain.json']){
  const s=JSON.parse(readFileSync(new URL('../../../../Games/games/led-sudoku/evidence/hints/'+file,import.meta.url),'utf8'));
  const m=new MobileSession();m.restore(s);m.explain();assert.equal(m.hint.kind,'elimination');const before=structuredClone(m.state);
  if(file.includes('chain'))assert(m.hint.steps.some(step=>step.title==='发现矛盾'));
  assert(m.applyHint());assert.deepEqual(m.state.board,before.board);assert(m.undo());assert.deepEqual(m.state,before);
 }
});

test('native pencil toggles crosses, erase and undo preserve them across reload',()=>{
 const m=new MobileSession();m.start(generate(DEFAULT_OPTIONS,20260920));const i=m.selected,d=m.choices[0];m.pencil=true;
 assert(m.input(d));assert(m.choices.includes(d));assert(m.state.crossed[i]&1<<(d-1));
 const n=new MobileSession();n.restore(JSON.parse(JSON.stringify(m.state)));assert.deepEqual(n.state.crossed,m.state.crossed);
 assert(m.input(d));assert.equal(m.state.crossed[i],0);assert(m.undo());assert(m.state.crossed[i]);
 assert(m.input(0));assert.equal(m.state.crossed[i],0);assert(m.undo());assert(m.state.crossed[i]);
});

test('native explanation distinguishes recorded candidates from pending ones and follows undo',()=>{
 const fixture=JSON.parse(readFileSync(new URL('../../../../Games/games/led-sudoku/evidence/hints/missing-xv-stalled.json',import.meta.url),'utf8'));
 const m=new MobileSession();m.restore(fixture);m.explain();assert.equal(m.hint.cell,8);
 m.pencil=true;assert(m.input(2));m.explain();assert.equal(m.hint.cell,17);assert.deepEqual(m.hint.eliminations,[{cell:17,digits:[2]}]);
 assert(m.input(2));const before=structuredClone(m.state);m.explain();assert.notDeepEqual(m.hint.eliminations,[{cell:8,digits:[2]},{cell:17,digits:[2]}]);assert.deepEqual(m.state,before);
 assert(m.applyHint());assert.equal(m.state.deductionSteps,2);assert(m.undo());assert.deepEqual(m.state,before);
 const resumed=new MobileSession();resumed.restore(JSON.parse(JSON.stringify(m.state)));resumed.explain();assert.equal(resumed.hint.deductionSteps,1);
 assert(m.undo());m.explain();assert.equal(m.hint.cell,17);assert(m.undo());m.explain();assert.equal(m.hint.cell,8);
});

test('restored notebook filters marks using the current board, with erase and undo',()=>{
 const fixture=JSON.parse(readFileSync(new URL('../../../../Games/games/led-sudoku/evidence/hints/notebook-stale-crosses.json',import.meta.url),'utf8'));
 const m=new MobileSession();m.restore(fixture);m.select(19);m.pencil=true;assert.deepEqual(m.choices,[1,8,9]);assert(!m.input(4));assert(!m.input(6));
 m.select(18);assert(m.input(0));m.select(19);assert(m.choices.includes(4)&&m.choices.includes(6));
 assert(m.undo());assert.deepEqual(m.choices,[1,8,9]);
 m.filterCandidates=false;assert.equal(m.choices.length,9);m.filterCandidates=true;assert.deepEqual(m.choices,[1,8,9]);
});

test('answer is a no-op on an already completed puzzle, preserving unassisted completion and undo history',()=>{
 const m=new MobileSession();m.start(generate(DEFAULT_OPTIONS,20260920));m.state.board=m.state.solution.slice();m.state.assisted=false;
 const before=structuredClone(m.state),history=m.history.length;m.answer();assert.deepEqual(m.state,before);assert.equal(m.history.length,history);
 m.state.board[m.selected]=0;m.answer();assert(m.done);assert(m.state.assisted);assert(m.undo());assert(!m.done);
});

test('staircase mobile notes, undo, answer and input support the lower-right cell',()=>{
 const g=generate({...DEFAULT_OPTIONS,staircase:true,led:false},39);g.puzzle.givens=g.solution.slice();g.puzzle.givens[143]=0;
 const m=new MobileSession();m.start(g);m.select(143);assert.equal(m.selected,143);assert.equal(m.state.notes.length,144);
 m.pencil=true;assert(m.input(g.solution[143]));assert(m.state.crossed[143]);assert(m.undo());m.pencil=false;assert(m.input(g.solution[143]));assert(m.done);assert(m.undo());assert(!m.done);m.answer();assert(m.done);assert.equal(m.state.notes.length,144);assert(isSaveData(m.state));
 m.select(9);assert.equal(m.selected,143,'tapping an absent box cannot change selection');
});
