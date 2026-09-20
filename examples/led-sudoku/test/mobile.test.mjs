import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context); } });
const { portraitLayout } = await import('../src/layout.ts');
const { MobileSession } = await import('../src/model.ts');
const { NativeGenerator } = await import('../src/generator.ts');
const { generate, DEFAULT_OPTIONS, isSaveData } = await import('../../../../Games/games/led-sudoku/rules.ts');
const { paintBoard } = await import('../../../../Games/games/led-sudoku/board-painter.ts');

test('portrait sizing keeps square board and nine large targets within tall phones', () => {
  for (const [w,h] of [[360,800],[390,844],[412,915],[393,873],[430,932]]) {
    const l = portraitLayout(w,h);
    assert(l.board <= w-20); assert(l.board >= 252); assert(l.keypad/3-6 >= 44);
    assert.equal(l.scroll,false); assert(l.contentHeight <= h-40);
  }
  const small = portraitLayout(320,568); assert(small.scroll); assert(small.board >= 252);
});
test('native session uses the same rule filters and immutable notes/undo/erase', () => {
  const m = new MobileSession(), g = generate(DEFAULT_OPTIONS,20260920); m.start(g);
  const i = g.puzzle.lights.findIndex(Boolean), v=g.solution[i]; m.select(i);
  m.pencil=true; assert(m.input(v)); assert(!m.state.board[i]); assert(m.state.notes[i]);
  m.pencil=false; assert(m.input(v)); assert.equal(m.state.board[i],v); assert.equal(m.state.notes[i],0);
  assert(m.undo()); assert(!m.state.board[i]); assert(m.state.notes[i]); assert(m.input(v)); assert(m.input(0));
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

test('iPhone safe-area content fits portrait layout without double-counting system insets', () => {
  // Heights exclude UIKit top/bottom safe areas; main-page adds only 8 pt spacing.
  for (const [width,height] of [[430,839],[393,759],[390,763],[428,845]]) {
    const l=portraitLayout(width,height,8,8);
    assert.equal(l.scroll,false);assert(l.contentHeight<=height-16);
    assert(l.board<=width-20);assert(l.keypad/3-6>=44);
  }
  const compact=portraitLayout(375,559,8,8);assert(compact.scroll);assert(compact.board>=252);assert(compact.keypad/3-6>=44);
});
