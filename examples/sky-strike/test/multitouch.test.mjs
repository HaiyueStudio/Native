import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {patchEngineInput} from '../scripts/patch-engine-input.mjs';
patchEngineInput();
const {GuiSystem,GuiRoot,GuiButton}=await import('@haiyue/engine/gui');
const source=readFileSync(new URL('../../../bridge/input/pointer-target.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {OrbitPointerTarget}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

function fixture(){
 const target=new OrbitPointerTarget(()=>({x:0,y:0,width:430,height:900}),'all');
 target.focus=()=>{};target.tabIndex=0;
 const capture=target.setPointerCapture.bind(target);
 target.setPointerCapture=id=>{if(target.hasActivePointer(id))capture(id);};
 const gui=new GuiSystem({canvas:target});gui.renderer.prepare=()=>{};
 const root=new GuiRoot();let bombs=0,pauses=0;
 const bomb=root.add(new GuiButton({x:10,y:800,width:90,height:82,onClick:()=>bombs++}));
 root.add(new GuiButton({x:330,y:800,width:90,height:82,onClick:()=>pauses++}));
 root.layout(430,900);gui.roots.add(root);
 const send=(action,id,x,y,flush=true)=>{target.handle(action,[{id,x,y}]);if(flush)gui.dispatchPendingEvents({});};
 return {target,gui,send,bomb,counts:()=>[bombs,pauses]};
}
test('shooting finger cannot steal the bomb finger; both release orders work',()=>{
 for(const releaseFirst of [true,false]){
  const f=fixture();f.send('down',1,210,840);f.send('down',2,50,840);
  f.send('move',1,230,870);
  if(releaseFirst)f.send('up',1,230,870);
  f.send('up',2,50,840);
  if(!releaseFirst)f.send('up',1,230,870);
  assert.deepEqual(f.counts(),[1,0]);assert.equal(f.gui.pressedPointers.size,0);f.target.dispose();f.gui.destroy();
 }
});
test('starting on bomb before dragging, cancelled touches, and same-frame taps stay independent',()=>{
 const f=fixture();f.send('down',2,50,840);f.send('down',1,220,840);f.send('up',2,50,840);assert.deepEqual(f.counts(),[1,0]);
 f.send('move',1,370,840);f.send('up',1,370,840);assert.deepEqual(f.counts(),[1,0],'dragging across pause must not click it');
 f.send('down',3,50,840);f.send('cancel',3,50,840);assert.deepEqual(f.counts(),[1,0]);
 f.send('down',4,50,840,false);f.send('up',4,50,840,false);f.gui.dispatchPendingEvents({});assert.deepEqual(f.counts(),[2,0]);
 f.send('down',5,50,840);f.send('down',6,370,840);f.target.suspend();f.gui.dispatchPendingEvents({});assert.deepEqual(f.counts(),[2,0]);assert.equal(f.gui.pressedPointers.size,0);
 f.target.dispose();f.gui.destroy();
});
test('bottom centre and HUD decoration allow flight; only actual buttons and modal block it',()=>{
 const hud=readFileSync(new URL('../../../games/sky-strike/guiHud.ts',import.meta.url),'utf8');
 const part=hud.slice(hud.indexOf('  acceptsGameplayInput('),hud.indexOf('  update(hud:'));
 const compiled=ts.transpileModule(`class Hud {${part}}`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 const Hud=new Function(`${compiled};return Hud;`)();
 const h=new Hud();h.root={root:{visible:true}};h.overlay={visible:false};
 h.bomb={button:{visible:true,rect:{x:125,y:1070,width:90,height:82}}};h.pause={button:{visible:true,rect:{x:605,y:1070,width:90,height:82}}};
 assert.equal(h.acceptsGameplayInput(400,1150),true);
 assert.equal(h.acceptsGameplayInput(400,20),true);
 assert.equal(h.acceptsGameplayInput(150,1090),false);assert.equal(h.acceptsGameplayInput(650,1090),false);
 h.overlay.visible=true;assert.equal(h.acceptsGameplayInput(400,1150),false);
});
test('primary-only bridge mode still suppresses extra fingers for other games',()=>{
 const target=new OrbitPointerTarget(()=>({x:0,y:0,width:430,height:900}));const down=[];
 target.addEventListener('pointerdown',e=>down.push(e.pointerId));target.handle('down',[{id:1,x:100,y:100},{id:2,x:200,y:200}]);
 assert.deepEqual(down,[1]);target.dispose();
});
