import {Screen} from '@nativescript/core';
import {createGame} from '../../../../Games/games/boxbound/levels';
import {clone,validState,gatePowered,playerMirrored,viewAction,type Vec} from '../../../../Games/games/boxbound/model';
import type {MobileGame} from './main-page';
import {captureSurfaceFrame} from '../../../bridge/render/frame-capture.ios';
const wait=(ms=100)=>new Promise<void>(r=>setTimeout(r,ms));
/** iOS device gameplay/render checks. Pointer injection tests the Engine input
 * contract, not synthesized UIKit touches; native observer attachment is separate. */
export async function runSmoke(game:MobileGame,report:(event:string,data:unknown)=>void){
 let checks=0;const check=(ok:unknown,name:string)=>{if(!ok)throw Error(name);checks++;report('smoke-check',{name,passed:true});};
 try{
  while(!game.ready)await wait();await game.start(true);await wait(600);
  const s=game.session!,scene=game.scene!,settle=async()=>{for(let i=0;i<120&&(scene.moving||scene.transitioning||scene.celebrating);i++)await wait();};
  const dirs:Record<string,Vec>={w:[0,0,-1],a:[-1,0,0],s:[0,0,1],d:[1,0,0]};
  const move=async(key:string)=>{s.act(viewAction(s.state,{type:'move',dir:dirs[key]!}));await settle();};
  const tap=async(rect:{x:number;y:number;width:number;height:number})=>{const p={id:2,x:rect.x+rect.width/2,y:rect.y+rect.height/2};game.handleTouch({action:'down',points:[p]});await wait(80);game.handleTouch({action:'up',points:[p]});await wait(250);};
  check(game.canvas.getActualSize().width>game.canvas.getActualSize().height,'iPhone landscape safe-area viewport');
  const full=game.snapshot().touch!.rect,screen=UIScreen.mainScreen.bounds.size,insets=game.snapshot().safeInsets;
  check(Math.abs(full.x)<.5&&Math.abs(full.y)<.5&&Math.abs(full.width-screen.width)<.5&&Math.abs(full.height-screen.height)<.5,'canvas covers full iPhone display without safe-area letterboxing');
  check(game.gui!.title.rect.x>=insets.left&&[game.gui!.jump,game.gui!.dive,game.gui!.settingsButton].every(b=>b.rect.x+b.rect.width<=full.width-insets.right&&b.rect.y+b.rect.height<=full.height-insets.bottom),'fixed HUD controls remain inside native safe insets');
  check(game.snapshot().touch?.nativeObserverCount===1,'one live native iOS touch observer');
  check(game.snapshot().gui==='Haiyue GuiSystem','Engine GUI on Metal');
  check(validState(s.state),'all authored maps loaded');
  check(game.engine!.msaaSamples===4&&game.engine!.devicePixelRatio===Math.min(Screen.mainScreen.scale,2),'MSAA and capped auto resolution');
  check(!game.gui!.stickBase.visible,'floating stick hidden at rest');
  check(game.gui!.replay.disabled,'replay disabled outside a small puzzle');
  check([game.gui!.undo,game.gui!.replay,game.gui!.exit,game.gui!.settingsButton].every(b=>Math.abs(b.children[0]!.rect.width-36.8)<.01&&Math.abs(b.children[0]!.rect.height-35.2)<.01),'top icons shrink by 20 percent with unchanged touch targets');
  const p={id:1,x:100,y:game.canvas.getActualSize().height-80};
  game.handleTouch({action:'down',points:[p]});await wait();
  check(game.gui!.stickBase.visible&&game.stickInput.joystick.state.center.x===100,'Engine pointer down anchors floating stick');
  game.handleTouch({action:'move',points:[{...p,y:p.y-45}]});await wait(800);
  check(s.state.moves>0,'held Engine pointer drives walking');
  await tap(game.gui!.jump.rect);check(!!s.held,'second Engine pointer leaves joystick held');
  game.handleTouch({action:'cancel',points:[p]});await settle();check(!s.held&&!game.gui!.stickBase.visible,'pointer cancellation releases controls');
  const count=s.state.moves;s.undo();await settle();check(s.state.moves<count,'undo works');
  await tap(game.gui!.settingsButton.rect);check(game.settingsOpen,'gear opens quality controls');
  await tap(game.gui!.msaaButton.rect);check(game.engine!.msaaSamples===1,'MSAA switch rebuilds render target');
  await tap(game.gui!.msaaButton.rect);await tap(game.gui!.closeSettingsButton.rect);check(!game.settingsOpen&&game.engine!.msaaSamples===4,'quality settings restore');
  s.load(createGame());for(const k of 'ddddwaaaaaaddwww')await move(k);
  check(s.state.player.pos.join()==='8,0,11'&&gatePowered(s.state,'world',s.state.rooms.world!.gates![0]!),'wide village gate puzzle');
  const initial=createGame(),g=initial.boxes.find(b=>b.id==='pp-gateway-1')!;
  initial.player={room:g.room,pos:[g.pos[0],1,g.pos[2]],facing:dirs.w!,route:[]};s.load(initial);await settle();
  await tap(game.gui!.dive.rect);await settle();check(s.state.player.room===g.inside,'Engine dive pointer enters box');
  const entryPosition=s.state.player.pos.join();await move('w');const movedPosition=s.state.player.pos.join();
  await tap(game.gui!.replay.rect);await settle();check(movedPosition!==entryPosition&&s.state.player.room===g.inside&&s.state.player.pos.join()===entryPosition,'top replay button resets the current puzzle in place');
  s.undo();await settle();check(s.state.player.pos.join()===movedPosition,'top replay can be undone');
  await tap(game.gui!.replay.rect);await settle();
  for(const k of 'wwdddsswwwaaaa')await move(k);await wait(1800);await settle();
  check(s.state.completed.includes(11)&&s.state.player.room==='pp-intro','completion returns to chapter');
  await game.saves!.service.flush();check((await game.saves!.load(1))?.completed.includes(11),'completion saves checkpoint');
  const saved=clone(s.state),flip=createGame(),gate=flip.boxes.find(b=>b.id==='pp-gateway-148')!;
  flip.player={room:gate.room,pos:[gate.pos[0],1,gate.pos[2]],facing:dirs.w!,route:[]};s.load(flip);await settle();s.act({type:'dive'});await settle();
  for(const k of 'aaassswwddddsdd')await move(k);
  check(playerMirrored(s.state)&&scene.occurrenceSnapshot().rootScale===-1,'Flip mirrored Metal scene');
  const x=s.state.player.pos[0];s.act({type:'move',dir:[-1,0,0]});await settle();check(s.state.player.pos[0]===x+1,'mirrored controls follow screen direction');
  s.undo();await settle();s.undo();await settle();check(!playerMirrored(s.state),'undo mirror crossing');
  s.exit();await settle();check(s.state.player.room==='pp-flip','exit mirrored independent puzzle');
  const audio=game.audio!.snapshot();check(!audio.error&&audio.buffers>0&&audio.played>0,'iOS PCM sounds loaded and played');
  s.load(saved);await settle();game.releaseStick();await wait(900);const frames=game.host!.renderingSnapshot().frames;await wait(500);check(game.host!.renderingSnapshot().frames===frames,'idle rendering sleeps');
  const adjacent=createGame(),red=adjacent.boxes.find(b=>b.id==='pp-reference5-la-1')!,blue=adjacent.boxes.find(b=>b.id==='pp-reference5-la-2')!;
  red.pos=[3,0,4];blue.pos=[3,0,3];adjacent.boxes.find(b=>b.id==='pp-reference5-la-3')!.pos=[3,0,5];
  const adjacentGate=adjacent.boxes.find(b=>b.levelEntry&&b.inside===red.inside)!;
  adjacent.player={room:red.inside!,pos:[5,0,3],facing:dirs.w!,route:[{box:adjacentGate.id,from:adjacentGate.room,entry:[...adjacentGate.pos]}]};
  s.load(adjacent);await settle();for(const key of 'wwaw')await move(key);
  const boxPoses=()=>JSON.stringify(s.state.boxes.map(b=>[b.id,b.room,b.inside,b.pos,!!b.flipped]));
  const boxesBefore=boxPoses(),actorBefore=scene.diagnostics.actorEntities.find(a=>a.id==='player')!.entities.join();
  await move('w');check(s.state.player.room===blue.inside&&s.history.at(-1)!.playerCrossing?.steps?.length===2,'Reference 5 adjacent crossing records both boundaries');
  check(boxPoses()===boxesBefore&&scene.diagnostics.actorEntities.find(a=>a.id==='player')!.entities.join()===actorBefore,'adjacent crossing keeps box placement and the original player');
  s.undo();await settle();check(s.state.player.room===red.inside&&s.state.player.pos.join()==='4,0,0','adjacent crossing undo restores the red exit');
  await move('w');
  // Read back while the frame texture is acquired, before native present.
  await new Promise<void>((resolve,reject)=>{const capture=()=>{game.engine!.off('after-update',capture);try{report('smoke-capture',captureSurfaceFrame(game.canvas,'boxbound-game.png'));resolve();}catch(e){reject(e);}};game.engine!.on('after-update',capture);scene.invalidate();game.requestFrame();});
  report('smoke-complete',{passed:true,checks,snapshot:game.snapshot()});
 }catch(e){report('smoke-failed',{checks,error:String(e),stack:e instanceof Error?e.stack:undefined});game.gui?.toast.setText(String(e));game.requestFrame();}
}
