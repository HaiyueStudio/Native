import {createGame,resetLevel} from '../../../../Games/games/boxbound/levels';
import type {MobileGame} from './main-page';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
/** Isolated debug workload exceeds the original 32,768-FD failure boundary. */
export async function runResourceStress(game:MobileGame,report:(event:string,data:unknown)=>void){
 // Canvas 2.1.18 dispatches pending GPU maps while presenting; keep the
 // demand renderer awake only during this debug workload.
 const heartbeat=setInterval(()=>game.requestFrame(),16);
 const device=game.engine!.device;
 const buffers=Array.from({length:100},()=>device.createBuffer({label:'callback-lifetime-stress',size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}));
 try{
 const probe=game.gpuProbe!;
 const baseline=probe.snapshot();report('resource-stress-start',baseline);
 for(let i=0;i<200;i++){
  const encoder=device.createCommandEncoder();for(const buffer of buffers)encoder.clearBuffer(buffer);
  device.queue.submit([encoder.finish()]);
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([Promise.all(buffers.map(b=>b.mapAsync(GPUMapMode.READ))),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('GPU stress readback timed out')),10000);})]);}
  finally{clearTimeout(timeout);}
  for(const buffer of buffers){if(new Uint32Array(buffer.getMappedRange())[0]!==0)throw Error('GPU stress readback did not complete');buffer.unmap();}
  if((i+1)%20===0){const sample=probe.snapshot();report('resource-stress-fences',{iterations:(i+1)*100,...sample});if(sample.fds>baseline.fds+32)throw Error('GPU callback file descriptors are accumulating');await wait(1);}
 }
 await wait(100);
 if(probe.snapshot().fds>baseline.fds+32)throw Error('GPU callback file descriptors are accumulating');
 const session=game.session!;
 const settle=async()=>{for(let i=0;i<100&&(game.scene!.moving||game.scene!.transitioning||game.scene!.celebrating);i++)await wait(50);if(game.scene!.moving||game.scene!.transitioning)throw Error('Mirror animation did not settle');};
 for(let pass=0;pass<3;pass++)for(let index=148;index<=155;index++){
  const state=createGame(),box=state.boxes.find(b=>b.id===`pp-gateway-${index}`)!,room=state.rooms[box.inside!]!;
  state.player={room:room.id,pos:[...(room.spawn??[0,0,0])],facing:[0,0,-1],route:[{box:box.id,from:box.room,entry:[box.pos[0],0,box.pos[2]+1]}]};
  session.load(resetLevel(state));game.requestFrame();await settle();
  for(const dir of [[1,0,0],[0,0,-1],[-1,0,0],[0,0,1]] as [number,number,number][]){session.act({type:'move',dir});await settle();}
  session.undo();await settle();session.reset();await settle();session.exit();await settle();
  report('resource-stress-mirror',{pass,level:index-147,...probe.snapshot(),scene:game.scene!.resourceSnapshot()});
 }
 await wait(200);
 const final=probe.snapshot();
 if(final.fds>baseline.fds+64)throw Error('Mirror scene switching leaked file descriptors');
 report('resource-stress-complete',{passed:true,baseline,final,iterations:20000,mirrorVisits:24});
 }finally{clearInterval(heartbeat);for(const buffer of buffers)buffer.destroy();}
}
