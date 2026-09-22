import {checkTwoFingerControls,checkDiveDown,checkQualityControls} from './touch-check.android';
import {validState,clone,gatePowered,playerMirrored,viewAction} from '../../../../Games/games/boxbound/model';
import {createGame} from '../../../../Games/games/boxbound/levels';
import {stickDirection} from './controls';
import type {MobileGame} from './main-page';
const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
export async function runSmoke(game:MobileGame,report:(event:string,data:unknown)=>void){let checks=0;const check=(ok:unknown,name:string)=>{if(!ok)throw Error(name);checks++;report('smoke-check',{name,passed:true});};
 try{while(!game.ready)await wait();await game.start(true);await wait(600);const s=game.session!;const settle=async()=>{for(let i=0;i<80&&(game.scene!.moving||game.scene!.transitioning||game.scene!.celebrating);i++)await wait(100);};
  check(game.snapshot().title==='箱庭迷境','Chinese app title');check(game.canvas.getActualSize().width>game.canvas.getActualSize().height,'landscape viewport');check(game.snapshot().gui==='Haiyue GuiSystem','HUD uses Engine GUI');check(!game.gui!.stickBase.visible,'floating joystick hidden at rest');check(game.gui!.jump.rect.height>=64&&game.gui!.dive.rect.height>=64,'large Engine action buttons');check(validState(s.state),'full authored map valid');check(await checkQualityControls(game,report),'live quality GUI touch controls');
  s.state.player.pos=[0,0,0];game.scene!.show(s.state);await settle();
  const originalShow=game.scene!.show.bind(game.scene),originalSave=s.save;let blockedDraws=0,blockedSaves=0;
  game.scene!.show=(...args)=>{blockedDraws++;return originalShow(...args);};s.save=state=>{blockedSaves++;originalSave(state);};
  s.setDirection([-1,0,0]);await wait(1800);game.releaseStick();game.scene!.show=originalShow;s.save=originalSave;
  check(blockedDraws===0&&blockedSaves===0,'held blocked input neither rebuilds nor saves');check(!s.state.message.includes('这里暂时走不通'),'no blocked-path toast');s.load(createGame());
  const before=s.state.moves;s.setDirection(stickDirection(0,-50));await wait(1000);game.releaseStick();await settle();check(s.state.moves>before,'holding stick moves repeatedly');const released=s.state.moves;await wait(600);check(s.state.moves===released,'released stick stops');
  const moved=clone(s.state);s.undo();await settle();check(s.state.moves<moved.moves,'undo restores previous move');
  s.load(createGame());game.scene!.show(s.state);await settle();
  for(const key of 'ddddwaaaaaaddwww'){const dir=({w:[0,0,-1],a:[-1,0,0],d:[1,0,0]} as const)[key as 'w'];s.act({type:'move',dir:[...dir]});await settle();}
  check(s.state.player.pos.join()==='8,0,11'&&gatePowered(s.state,'world',s.state.rooms.world!.gates![0]!), 'three-cell village gate opens by moving the right crate onto the left plate');
  s.load(createGame());const starter=s.state.boxes.find(b=>b.id==='island-weight')!;s.state.player.pos=[starter.pos[0],0,starter.pos[2]+1];game.scene!.show(s.state);await wait(500);check(await checkTwoFingerControls(game,report),'native two-finger joystick and jump dispatch');
  s.load(createGame());s.state.player.pos=[8,0,3];game.scene!.show(s.state);s.act({type:'move',dir:[0,0,-1]});await settle();check(s.state.player.room==='pp-hub','walk into Parabox');
  const visibleLabels=game.scene!.labelSnapshot();check(visibleLabels.some(l=>l.visible)&&visibleLabels.some(l=>!l.visible),'chapter and exit labels respect player proximity');
  const chapter=s.state.boxes.find(b=>b.id==='pp-chapter-intro')!;s.state.player.pos=[chapter.pos[0],0,chapter.pos[2]+1];game.scene!.show(s.state);check(await checkDiveDown(game),'dive activates on down exactly once');await settle();check(s.state.player.room==='pp-intro','dive enters chapter');check(s.state.rooms['pp-intro']!.size===11,'compact chapter retained');
  const gate=s.state.boxes.find(b=>b.id==='pp-gateway-1')!;s.state.player.pos=[gate.pos[0],0,gate.pos[2]+1];game.scene!.show(s.state);s.act({type:'move',dir:[0,0,-1],jump:true});await settle();check(s.state.player.pos[1]===1,'closed level box climbed without entering');s.act({type:'dive'});await settle();check(s.state.player.room==='pp-intro1-lr','enter first puzzle');
  s.jump();check(game.scene!.airborne,'jump button starts hop');await wait(1000);
  for(const key of 'wwdddsswwwaaaa'){const dir=({w:[0,0,-1],s:[0,0,1],a:[-1,0,0],d:[1,0,0]} as const)[key as 'w'];s.act({type:'move',dir:[...dir]});await settle();}
  await wait(1500);await settle();check(s.state.completed.includes(11),'first puzzle completes');check(s.state.player.room==='pp-intro','completion returns to chapter');await game.saves!.service.flush();const checkpoint=await game.saves!.load(1);check(checkpoint?.player.room==='pp-intro'&&checkpoint.completed.includes(11),'completion autosaves outside the puzzle');
  s.state.player.pos=[gate.pos[0],0,gate.pos[2]+1];game.scene!.show(s.state);s.act({type:'move',dir:[0,0,-1],jump:true});await settle();s.act({type:'dive'});await settle();s.exit();await settle();check(s.state.player.room==='pp-intro','exit-level button returns safely');check(validState(s.state),'state remains valid');
  const beforeMirror=clone(s.state), mirror=createGame(), mirrorGate=mirror.boxes.find(b=>b.id==='pp-gateway-148')!;
  mirror.player={room:mirrorGate.room,pos:[mirrorGate.pos[0],1,mirrorGate.pos[2]],facing:[0,0,-1],route:[]};
  s.load(mirror);await settle();s.act({type:'dive'});await settle();
  for(const key of 'aaassswwddddsdd'){
    const dir=({w:[0,0,-1],s:[0,0,1],a:[-1,0,0],d:[1,0,0]} as const)[key as 'w'];
    s.act(viewAction(s.state,{type:'move',dir:[...dir]}));await settle();
  }
  const reflected=game.scene!.occurrenceSnapshot(), current=game.scene!.diagnostics.playerInstances.find(p=>p.layer==='current')!;
  check(playerMirrored(s.state)&&reflected.rootScale===-1&&reflected.winding==='cw'&&Math.abs(reflected.playerWorld[0]!+current.position[0])<1e-4,'Flip occurrence uses a reflected engine world transform and correct winding');
  const oldX=s.state.player.pos[0];s.act({type:'move',dir:[-1,0,0]});await settle();
  check(s.state.player.pos[0]===oldX+1,'mirrored joystick left moves left on screen');
  s.undo();await settle();s.undo();await settle();check(!playerMirrored(s.state)&&!game.scene!.occurrenceSnapshot().mirrored,'undo mirror crossing restores display orientation');
  s.act({type:'move',dir:[1,0,0]});await settle();s.reset();await settle();check(!playerMirrored(s.state),'reset restores authored occurrence orientation');
  const self=s.state.boxes.find(b=>b.id==='pp-flip1-la-1')!;self.fixed=true;s.state.player.pos=[2,0,4];game.scene!.show(s.state);await settle();
  s.act({type:'move',dir:[1,0,0]});await settle();check(playerMirrored(s.state)&&game.scene!.occurrenceSnapshot().mirrored,'entering a mirrored box keeps its miniature orientation');
  s.exit();await settle();check(s.state.player.room==='pp-flip'&&!playerMirrored(s.state),'leaving mirrored puzzle restores chapter orientation');
  s.load(beforeMirror);await settle();
  const final=clone(s.state);await game.saves!.save(1,final);await game.saves!.service.flush();const saved=await game.saves!.load(1);check(JSON.stringify(saved)===JSON.stringify(final),'native save reload retains full state');
  game.releaseStick();check(s.held===null,'input canceled');await wait(900);const idleFrames=game.host!.renderingSnapshot().frames;await wait(500);check(game.host!.renderingSnapshot().frames===idleFrames,'idle renderer sleeps without RAF');report('smoke-complete',{passed:true,checks,snapshot:game.snapshot()});
 }catch(e){report('smoke-failed',{checks,error:String(e)});game.gui!.toast.setText(String(e));game.requestFrame();}
}
