import {File,knownFolders,path} from '@nativescript/core';
import type {HaiyueEngine} from '@haiyue/engine';
import type {OrbitPointerTarget} from '../../../bridge/input/pointer-target';
import type {SkyStrikeGame} from '../../../games/sky-strike/SkyStrikeGame';
import type {SkyStrikeGuiHud} from '../../../games/sky-strike/guiHud';

/** Inject after the native recognizer, through the real input target and engine GUI. */
export function inputProbe(engine:HaiyueEngine,target:OrbitPointerTarget,game:SkyStrikeGame,hud:SkyStrikeGuiHud):()=>void {
 const d=game as any,ui=hud as any,rows:unknown[]=[];
 let frame=0,done=false;
 const output=File.fromPath(path.join(knownFolders.documents().path,'sky-input-probe.json'));
 const write=(extra:object)=>output.writeTextSync(JSON.stringify({memorySave:true,rows,...extra}));
 const send=(action:'down'|'move'|'up',id:number,point:{x:number;y:number})=>target.handle(action,[{id,...point}]);
 const center=(button:any)=>({x:button.rect.x+button.rect.width/2,y:button.rect.y+button.rect.height/2});
 const check=(label:string,pass:boolean)=>{rows.push({label,pass,state:game.snapshot(),pointerId:d.pointerId,input:target.snapshot()});if(!pass)throw new Error(label);};
 const after=()=>{
  if(done)return;
  try{
   frame++;
   const bottom={x:engine.displayWidth/2,y:engine.displayHeight-24};
   if(frame===1){d.selectedLevelIndex=0;d.startSortie();d.levelTimeline=[];d.player.invulnerableMs=99999;}
   if(frame===10)send('down',101,bottom);
   if(frame===18)check('bottom-centre starts flight',d.pointerFiring&&d.pointerId===101);
   if(frame===20)send('down',102,center(ui.bomb.button));
   if(frame===25)send('move',101,{x:bottom.x+25,y:bottom.y-15});
   if(frame===30)send('up',102,center(ui.bomb.button));
   if(frame===40)check('second finger bombs while first keeps firing',d.bombs===2&&d.pointerFiring&&d.pointerId===101);
   if(frame===130)send('down',103,center(ui.bomb.button));
   if(frame===132)send('up',101,bottom);
   if(frame===135)send('up',103,center(ui.bomb.button));
   if(frame===145)check('releasing flight first does not cancel bomb',d.bombs===1&&!d.pointerFiring&&d.pointerId===-1);
   if(frame===150)send('down',104,bottom);
   if(frame===160)send('down',105,center(ui.pause.button));
   if(frame===165)send('up',105,center(ui.pause.button));
   if(frame===175){check('second finger pauses and stops firing',d.phase==='paused'&&!d.pointerFiring);target.cancel();done=true;write({complete:true});}
  }catch(error){done=true;target.cancel();game.suspend();write({complete:false,error:String(error)});}
 };
 engine.on('after-update',after);write({complete:false});
 return()=>{done=true;engine.off('after-update',after);target.cancel();};
}
