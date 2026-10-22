import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';
import {GuiSystem,GuiRoot,GuiInput} from '../../Engine/engine/dist/gui.js';
const {OrbitPointerTarget}=loadTS('bridge/input/pointer-target.ts');

test('native pointer transport drives the actual public GUI input/focus owner and releases its only text lease',()=>{
 const target=new OrbitPointerTarget(()=>({x:10,y:30,width:200,height:200}));
 let request,opened=0,closed=0;
 const host={open(q){request=q;opened++;return {setValue(){},setSelection(){},setCaretRect(){},close(){closed++;}};}};
 const canvas={tabIndex:0,getBoundingClientRect:()=>target.getBoundingClientRect(),focus(){},addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target),setPointerCapture:target.setPointerCapture.bind(target),releasePointerCapture:target.releasePointerCapture.bind(target)};
 const system=new GuiSystem({canvas,displayWidth:200,displayHeight:200},{textInputHost:host}),root=new GuiRoot();
 const input=root.add(new GuiInput({x:20,y:20,width:160,value:'A😀B'}));system.roots.add(root);root.layout(200,200);system.inputDomain.refresh();system.renderer.prepare=()=>{};
 try{
  target.handle('down',[{id:1,x:50,y:35}]);target.handle('up',[{id:1,x:50,y:35}]);
  assert.equal(system.focus.focused,input);assert.equal(opened,1);assert.ok(request);
  input.setCaret(3);request.onCommand('deleteBackward');assert.equal(input.value,'AB');
  assert.equal(target.snapshot().trackedTouches,0);system.destroy();assert.equal(closed,1);assert.equal(target.snapshot().listenerCount,0);
 }finally{system.destroy();root.destroy();target.dispose();}
});
