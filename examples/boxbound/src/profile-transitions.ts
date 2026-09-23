import {Application} from '@nativescript/core';
import {getEngineDiagnosticsSnapshot} from '@haiyue/engine/diagnostics';
import {createGame} from '../../../../Games/games/boxbound/levels';
import type {MobileGame} from './main-page';
const wait=(ms=30)=>new Promise<void>(r=>setTimeout(r,ms));
/** Finite, isolated device workload; records synchronous build and rendered-frame
 * costs separately. Backgrounding invalidates a sample instead of faking a lag. */
export async function profileTransitions(game:MobileGame,report:(event:string,data:unknown)=>void){
 const s=game.session!,scene=game.scene!,engine=game.engine!;
 const impl=scene as unknown as {rebuild(...args:unknown[]):void};const rebuild=impl.rebuild;
 let active=false,begin=0,last=0,frames:{at:number;gap:number;cpu:Record<string,number>;counters:Record<string,number>}[]=[],builds:number[]=[];
 const frame=()=>{if(!active)return;const now=performance.now(),d=getEngineDiagnosticsSnapshot(engine).frame;frames.push({at:now-begin,gap:now-last,cpu:{...d.cpuMs},counters:{...d.counters}});last=now;};
 impl.rebuild=function(...args){const t=performance.now();try{return rebuild.apply(scene,args);}finally{if(active)builds.push(performance.now()-t);}};
 engine.on('after-update',frame);
 const settle=async()=>{let ticks=0;do{await wait();if(Application.inBackground||Application.suspended){while(Application.inBackground||Application.suspended)await wait(200);throw Error('Profile interrupted by application backgrounding');}if(++ticks>2500)throw Error('Transition timed out');}while(scene.moving||scene.transitioning||scene.celebrating||scene.hasPendingFrame);};
 const measure=async(name:string,act:()=>void)=>{
  frames=[];builds=[];begin=last=performance.now();active=true;act();const synchronousMs=performance.now()-begin;await settle();active=false;
  report('profile-transition',{name,synchronousMs,elapsedMs:performance.now()-begin,builds,frames,resources:scene.resourceSnapshot(),room:s.state.player.room});
 };
 try{
  await game.start(true);await settle();
  for(const [label,id] of [['Intro 1','pp-gateway-1'],['Reference 1','pp-gateway-54'],['Flip 1','pp-gateway-148'],['Clone 1','pp-gateway-83'],['Transfer 1','pp-gateway-107']] as const){
   const state=createGame(),b=state.boxes.find(v=>v.id===id)!;
   state.player={room:b.room,pos:[b.pos[0],1,b.pos[2]],facing:[0,0,-1],route:[]};
   await measure(label+' gallery load',()=>s.load(state));
   for(let repeat=0;repeat<2;repeat++){
    s.state.player.pos=[b.pos[0],1,b.pos[2]];scene.show(s.state);s.wake();await settle();
    await measure(`${label} enter ${repeat}`,()=>s.act({type:'dive'}));
    await measure(`${label} exit ${repeat}`,()=>s.exit());
   }
  }
  report('profile-transitions-complete',{passed:true,snapshot:game.snapshot()});
 }catch(e){active=false;report('profile-transitions-failed',{error:String(e),snapshot:game.snapshot()});}
 finally{active=false;impl.rebuild=rebuild;engine.off('after-update',frame);game.releaseStick();}
}
