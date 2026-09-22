import {getEngineDiagnosticsSnapshot} from '@haiyue/engine/diagnostics';
import {createGame} from '../../../../Games/games/boxbound/levels';
import type {MobileGame} from './main-page';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const stats=(a:number[])=>{const b=[...a].sort((x,y)=>x-y);return{samples:a.length,mean:a.reduce((s,x)=>s+x,0)/Math.max(1,a.length),p95:b[Math.max(0,Math.ceil(b.length*.95)-1)]??0,max:b.at(-1)??0};};
const summaries=(data:Record<string,number[]>)=>Object.fromEntries(Object.entries(data).map(([key,value])=>[key,stats(value)]));
/** Debug-only paired shadow A/B, isolated saves; ABBA balances warm-up/order effects. */
export async function profileMobile(game:MobileGame,report:(event:string,data:unknown)=>void){
 await game.start(true);const s=game.session!,scene=game.scene!,engine=game.engine!;
 let measuring=false,last=0,intervals:number[]=[],stages:Record<string,number[]>={},counters:Record<string,number[]>={};
 const frame=()=>{
  if(!measuring)return;
  const now=performance.now(),d=getEngineDiagnosticsSnapshot(engine).frame;
  if(d.counters.draws<=0){last=0;return;}
  if(last)intervals.push(now-last);last=now;
  for(const [key,value] of Object.entries(d.counters))(counters[key]??=[]).push(value);
  for(const [key,value] of Object.entries(d.cpuMs))(stages[key]??=[]).push(value);
 };
 const hop=async()=>{
  last=0;scene.jumpInPlace();game.requestFrame();
  const deadline=performance.now()+5000;
  while(scene.airborne||scene.hasPendingFrame){
   if(performance.now()>deadline)throw Error('Shadow profile animation did not settle');
   await wait(16);
  }
  last=0;
 };
 engine.on('after-update',frame);
 try{
  // Let initial pipelines, GUI textures and the native startup capture settle.
  const captureDeadline=performance.now()+15000;
  while(game.host!.renderingSnapshot().frames<130){
   if(performance.now()>captureDeadline)throw Error('Startup capture warm-up did not finish');
   game.requestFrame();await wait(16);
  }
  await wait(500);
  for(const [name,id] of [['World',null],['Intro 1','pp-gateway-1'],['Reference 1','pp-gateway-54']] as const){
   const state=createGame();
   if(id){
    const gate=state.boxes.find(b=>b.id===id)!,room=state.rooms[gate.inside!]!;
    state.player={room:room.id,pos:[...room.spawn!],facing:[0,0,-1],route:[{box:gate.id,from:gate.room,entry:[gate.pos[0],0,gate.pos[2]+1]}]};
   }
   s.load(state);await wait(800);
   for(const [pass,shadows] of [true,false,false,true].entries()){
    scene.setShadowsEnabled(shadows);game.requestFrame();await wait(300);
    await hop(); // Compile/warm changed pipelines outside the measurement.
    intervals=[];stages={};counters={};measuring=true;
    for(let i=0;i<8;i++)await hop();
    measuring=false;
    report('profile-shadows',{name,pass,shadows,workload:'8 in-place jumps; active rendered frames only; ABBA',
     viewport:game.snapshot().viewport,intervalMs:stats(intervals),counters:summaries(counters),cpuStages:summaries(stages),
     triangles:scene.triangleSnapshot(),scene:scene.resourceSnapshot()});
   }
  }
 }finally{
  measuring=false;engine.off('after-update',frame);game.releaseStick();
  scene.setShadowsEnabled(false);game.requestFrame();
 }
}
