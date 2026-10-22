import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';
const {NativeTextInputSession}=loadTS('bridge/input/text-input-session.ts');
function fixture(){
 const events=[],calls=[];let snapshot={value:'A😀B',selection:[1,3],marked:null},lease;
 const request={value:'A😀B',selectionUtf16:[1,3],inputType:'text',multiline:false,generation:11,
  onComposition:e=>events.push({kind:'composition',...e}),onValue:(value,selection,generation,eventId)=>events.push({kind:'value',value,selection,generation,eventId}),
  onSelection:(...v)=>events.push({kind:'selection',values:v}),onEdit:e=>events.push({kind:'edit',...e}),onViewportInset:i=>events.push({kind:'inset',inset:i}),onCommand:command=>events.push({kind:'command',command}),onFocusLost:generation=>events.push({kind:'blur',generation})};
 lease=new NativeTextInputSession(request,()=>calls.push('closed'));
 const driver={setValue:value=>{calls.push(['value',value]);},setSelection:(...v)=>calls.push(['selection',...v]),setCaretRect:r=>calls.push(['caret',r]),snapshot:()=>snapshot,unmarkText:()=>{snapshot={...snapshot,marked:null};lease.nativeChanged(snapshot);},close:()=>calls.push('driver-close')};
 lease.attach(driver);return {lease,events,calls,request,driver,set:value=>{snapshot=value;},clear:()=>{events.length=0;}};
}
test('native marked text stays preview and emits one explicit commit when UIKit clears the mark',()=>{
 const f=fixture();f.lease.beginComposition();f.set({value:'A中文B',selection:[3,3],marked:[1,3]});f.lease.nativeChanged(f.driver.snapshot());
 assert.equal(f.events.filter(e=>e.kind==='value').length,0);assert.equal(f.events.filter(e=>e.phase==='start').length,1);assert.equal(f.events.find(e=>e.phase==='update').text,'中文');
 f.set({value:'A中B',selection:[2,2],marked:null});f.lease.nativeChanged(f.driver.snapshot());assert.equal(f.events.find(e=>e.phase==='commit').text,'中');
 assert.equal(f.lease.composing,false);f.lease.close();assert.equal(f.calls.filter(c=>c==='driver-close').length,1);
});
test('native cancellation and suspend never silently commit preview; late native events are ignored',()=>{
 const f=fixture();f.lease.beginComposition();f.lease.nativeChanged({value:'A中B',selection:[2,2],marked:[1,2]});f.clear();f.lease.suspend();
 assert.deepEqual(f.events.map(e=>e.kind==='composition'?e.phase:e.kind),['cancel','blur']);
 f.lease.nativeChanged({value:'bad',selection:[3,3],marked:null});f.lease.nativeSelectionChanged({value:'bad',selection:[0,0],marked:null});f.lease.viewportInset({top:0,right:0,bottom:30,left:0});
 assert.equal(f.events.length,2);f.lease.close();assert.equal(f.calls.filter(c=>c==='closed').length,1);
});
test('ordinary native snapshots delegate all Unicode normalization and length policy to Engine',()=>{
 const f=fixture();f.lease.nativeChanged({value:'A😁B',selection:[3,3],marked:null});
 const event=f.events[0];assert.equal(event.kind,'value');assert.equal(event.value,'A😁B');assert.equal(event.generation,11);
 assert.deepEqual(Array.from(event.selection),[3,3]);assert.equal(f.lease.shouldReplace(2,3,''),false);assert.equal(f.events.at(-1).kind,'edit');
 assert.equal(f.events.at(-1).startUtf16,2);assert.equal(f.lease.shouldReplace(3,3,'\n'),false);assert.equal(f.events.at(-1).command,'submit');f.lease.close();
});
test('finish returns an explicit confirmation even when native unmark synchronously dispatches completion',()=>{
 const f=fixture();f.lease.beginComposition();f.set({value:'A中B',selection:[2,2],marked:[1,2]});f.lease.nativeChanged(f.driver.snapshot());
 const result=f.lease.finish();assert.equal(result.phase,'commit');assert.equal(result.text,'中');assert.equal(result.generation,11);
 assert.equal(f.events.filter(e=>e.phase==='commit').length,1);f.lease.close();
});
test('cancel restores original native content without producing a replacement edit',()=>{
 const f=fixture();f.lease.beginComposition();f.lease.nativeChanged({value:'A中B',selection:[2,2],marked:[1,2]});
 f.lease.nativeChanged({value:'A😀B',selection:[1,3],marked:null});assert.equal(f.events.at(-1).phase,'cancel');assert.equal(f.events.some(e=>e.kind==='value'),false);f.lease.close();
});

test('unmark without a synchronous cleared mark is not a confirmed blur commit',()=>{
 const f=fixture();f.driver.unmarkText=()=>{};f.lease.beginComposition();f.set({value:'A中B',selection:[2,2],marked:[1,2]});f.lease.nativeChanged(f.driver.snapshot());
 assert.equal(f.lease.finish(),null);assert.equal(f.events.some(e=>e.phase==='commit'),false);f.lease.suspend();assert.equal(f.events.some(e=>e.phase==='cancel'),true);
});
