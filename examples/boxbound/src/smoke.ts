import {checkTwoFingerControls} from './touch-check.android';
import {validState,clone} from '../../../../Games/games/boxbound/model';
import {createGame} from '../../../../Games/games/boxbound/levels';
import {stickDirection} from './controls';
import type {MobileGame} from './main-page';
const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
export async function runSmoke(game:MobileGame,report:(event:string,data:unknown)=>void){let checks=0;const check=(ok:unknown,name:string)=>{if(!ok)throw Error(name);checks++;report('smoke-check',{name,passed:true});};
 try{while(!game.ready)await wait();await game.start(true);await wait(600);const s=game.session!;const settle=async()=>{for(let i=0;i<80&&(game.scene!.moving||game.scene!.transitioning||game.scene!.celebrating);i++)await wait(100);};
  check(game.snapshot().title==='箱庭迷境','Chinese app title');check(game.canvas.getActualSize().width>game.canvas.getActualSize().height,'landscape viewport');check(game.stick.opacity<1,'translucent joystick');check(game.jump.getActualSize().height>=64&&game.dive.getActualSize().height>=64,'large action buttons');check(validState(s.state),'full authored map valid');
  const before=s.state.moves;s.setDirection(stickDirection(0,-50));await wait(1000);game.releaseStick();await settle();check(s.state.moves>before,'holding stick moves repeatedly');const released=s.state.moves;await wait(600);check(s.state.moves===released,'released stick stops');
  const moved=clone(s.state);s.undo();await settle();check(s.state.moves<moved.moves,'undo restores previous move');
  s.load(createGame());s.state.player.pos=[7,0,15];game.scene!.show(s.state);await wait(500);check(await checkTwoFingerControls(game,report),'native two-finger joystick and jump dispatch');
  s.load(createGame());s.state.player.pos=[8,0,3];game.scene!.show(s.state);s.act({type:'move',dir:[0,0,-1]});await settle();check(s.state.player.room==='pp-hub','walk into Parabox');
  const chapter=s.state.boxes.find(b=>b.id==='pp-chapter-intro')!;s.state.player.pos=[chapter.pos[0],0,chapter.pos[2]+1];game.scene!.show(s.state);s.act({type:'dive'});await settle();check(s.state.player.room==='pp-intro','dive enters chapter');check(s.state.rooms['pp-intro']!.size===11,'compact chapter retained');
  const gate=s.state.boxes.find(b=>b.id==='pp-gateway-1')!;s.state.player.pos=[gate.pos[0],0,gate.pos[2]+1];game.scene!.show(s.state);s.act({type:'move',dir:[0,0,-1]});await settle();check(s.state.player.room==='pp-intro1-lr','enter first puzzle');
  s.jump();check(game.scene!.airborne,'jump button starts hop');await wait(1000);
  for(const key of 'wwdddsswwwaaaa'){const dir=({w:[0,0,-1],s:[0,0,1],a:[-1,0,0],d:[1,0,0]} as const)[key as 'w'];s.act({type:'move',dir:[...dir]});await settle();}
  await wait(1500);await settle();check(s.state.completed.includes(11),'first puzzle completes');check(s.state.player.room==='pp-intro','completion returns to chapter');
  s.state.player.pos=[gate.pos[0],0,gate.pos[2]+1];game.scene!.show(s.state);s.act({type:'move',dir:[0,0,-1]});await settle();s.exit();await settle();check(s.state.player.room==='pp-intro','exit-level button returns safely');check(validState(s.state),'state remains valid');
  const final=clone(s.state);await game.saves!.save(1,final);await game.saves!.service.flush();const saved=await game.saves!.load(1);check(JSON.stringify(saved)===JSON.stringify(final),'native save reload retains full state');
  game.releaseStick();check(s.held===null,'input canceled');report('smoke-complete',{passed:true,checks,snapshot:game.snapshot()});
 }catch(e){report('smoke-failed',{checks,error:String(e)});game.toast.text=String(e);}
}
