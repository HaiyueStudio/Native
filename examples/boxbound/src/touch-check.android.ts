import {Application,Screen} from '@nativescript/core';
import type {MobileGame} from './main-page';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
/** Real multi-pointer MotionEvents pass through Canvas -> native bridge -> Engine GUI/joystick. */
function sender(game:MobileGame){
 const decor=(Application.android.foregroundActivity??Application.android.startActivity).getWindow().getDecorView(),xy=Array.create('int',2);
 (game.canvas.nativeViewProtected as android.view.View).getLocationInWindow(xy);const down=android.os.SystemClock.uptimeMillis();
 return(action:number,points:{x:number;y:number}[])=>{const props=Array.create(android.view.MotionEvent.PointerProperties,points.length),coords=Array.create(android.view.MotionEvent.PointerCoords,points.length);
  points.forEach((p,i)=>{const prop=new android.view.MotionEvent.PointerProperties();prop.id=i;prop.toolType=android.view.MotionEvent.TOOL_TYPE_FINGER;props[i]=prop;const c=new android.view.MotionEvent.PointerCoords();c.x=xy[0]+p.x*Screen.mainScreen.scale;c.y=xy[1]+p.y*Screen.mainScreen.scale;c.pressure=1;c.size=1;coords[i]=c;});
  const e=android.view.MotionEvent.obtain(down,android.os.SystemClock.uptimeMillis(),action,points.length,props,coords,0,0,1,1,0,0,android.view.InputDevice.SOURCE_TOUCHSCREEN,0);try{decor.dispatchTouchEvent(e);}finally{e.recycle();}
 };
}
export async function checkTwoFingerControls(game:MobileGame,report:(event:string,data:unknown)=>void){
 const send=sender(game),h=game.canvas.getActualSize().height,start={x:128,y:h-90},stick={x:128,y:h-134},r=game.gui!.jump.rect,jump={x:r.x+r.width/2,y:r.y+r.height/2};
 const s=game.session!,before=s.state.moves,history=s.history.length,original=s.jump.bind(s);let calls=0;s.jump=()=>{calls++;original();};
 try{
  const hidden=!game.gui!.stickBase.visible;send(android.view.MotionEvent.ACTION_DOWN,[start]);await wait(60);
  const centered=game.gui!.stickBase.visible&&game.stickInput.joystick.state.center.x===start.x&&game.stickInput.joystick.state.center.y===start.y&&s.held===null;
  send(android.view.MotionEvent.ACTION_MOVE,[stick]);await wait(220);send(android.view.MotionEvent.ACTION_POINTER_DOWN|(1<<8),[stick,jump]);
  for(let i=0;i<12&&!calls;i++)await wait(16);const onDown=calls===1;
  send(android.view.MotionEvent.ACTION_POINTER_UP|(1<<8),[stick,jump]);await wait(120);const stillHeld=!!s.held;
  await wait(750);send(android.view.MotionEvent.ACTION_UP,[stick]);await wait(350);
  const ended=!game.gui!.stickBase.visible&&s.held===null;
  // A later press establishes a different center. System cancellation hides both textures.
  const next={x:210,y:h-105};send(android.view.MotionEvent.ACTION_DOWN,[next]);await wait(60);const recentered=game.stickInput.joystick.state.center.x===next.x;
  send(android.view.MotionEvent.ACTION_CANCEL,[next]);await wait(80);const canceled=!game.gui!.stickBase.visible&&s.held===null;
  const result={hidden,centered,onDown,calls,stillHeld,ended,recentered,canceled,before,after:s.state.moves,history:s.history.slice(history).map(h=>({jump:h.jump,pos:h.state.player.pos}))};report('multi-touch-result',result);
  return hidden&&centered&&onDown&&calls===1&&stillHeld&&ended&&recentered&&canceled&&s.state.moves>before&&s.history.slice(history).some(h=>h.jump);
 }finally{s.jump=original;send(android.view.MotionEvent.ACTION_CANCEL,[stick]);game.releaseStick();}
}
export async function checkDiveDown(game:MobileGame){const send=sender(game),r=game.gui!.dive.rect,p={x:r.x+r.width/2,y:r.y+r.height/2},s=game.session!,original=s.act.bind(s);let calls=0;s.act=a=>{if(a.type==='dive')calls++;original(a);};
 try{send(android.view.MotionEvent.ACTION_DOWN,[p]);for(let i=0;i<12&&!calls;i++)await wait(16);const immediate=calls===1;send(android.view.MotionEvent.ACTION_UP,[p]);await wait(180);return immediate&&calls===1;}
 finally{s.act=original;send(android.view.MotionEvent.ACTION_CANCEL,[p]);}
}

/** Exercise live render-target changes through real GUI touch events. */
export async function checkQualityControls(game:MobileGame,report:(event:string,data:unknown)=>void){
 const gui=game.gui!,send=sender(game),before=game.quality, moves=game.session!.state.moves;
 const tap=async(node:{rect:{x:number;y:number;width:number;height:number}})=>{
  const r=node.rect,p={x:r.x+r.width/2,y:r.y+r.height/2};
  send(android.view.MotionEvent.ACTION_DOWN,[p]);await wait(45);send(android.view.MotionEvent.ACTION_UP,[p]);await wait(250);
 };
 const check=(ok:unknown,name:string)=>{if(!ok)throw Error(name);report('quality-check',{name,passed:true});};
 try{
  check(game.engine!.msaaSamples===4&&game.engine!.devicePixelRatio===Math.min(Screen.mainScreen.scale,2),'default MSAA 4x and capped device ratio');
  await tap(gui.settingsButton);check(game.settingsOpen&&game.session!.paused&&gui.settingsPanel.visible,'gear opens Engine settings and pauses input');
  await tap(gui.msaaButton);check(!game.quality.msaa&&game.engine!.msaaSamples===1,'MSAA switches off on next frame');
  await tap(gui.ratioButtons[1]!);check(game.engine!.devicePixelRatio===1,'pixel ratio switches to one');
  await tap(gui.ratioButtons[4]!);check(game.engine!.devicePixelRatio===3,'explicit pixel ratio can exceed auto cap');
  await tap(gui.ratioButtons[0]!);await tap(gui.msaaButton);
  check(game.engine!.msaaSamples===4&&game.engine!.devicePixelRatio===Math.min(Screen.mainScreen.scale,2),'restores MSAA and automatic resolution');
  await tap(gui.closeSettingsButton);check(!game.settingsOpen&&!game.session!.paused&&!gui.settingsPanel.visible&&game.session!.state.moves===moves,'settings close preserves gameplay and releases input');
  check(gui.stickBase.tint==='#ffffff80'&&gui.stickThumb.tint==='#ffffff80','joystick uses 50 percent opacity');
  const buttons=[gui.settingsButton,gui.undo,gui.exit,gui.jump,gui.dive];
  check(buttons.every(b=>b.style.backgroundColor==='#00000000'&&b.children.some(c=>'source' in c&&!!c.source)),'generated icons loaded with transparent button backgrounds');
  return true;
 }finally{game.setQuality(before);game.closeSettings();send(android.view.MotionEvent.ACTION_CANCEL,[{x:1,y:1}]);game.releaseStick();await wait(300);}
}
