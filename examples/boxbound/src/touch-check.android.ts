import {Application,Screen,type View} from '@nativescript/core';
import type {MobileGame} from './main-page';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
/** Debug smoke only: dispatch real Android multi-pointer events through the
 * window, so native hit-testing/split gesture delivery owns both controls. */
export async function checkTwoFingerControls(game:MobileGame,report:(event:string,data:unknown)=>void):Promise<boolean>{
  const center=(view:View,dy=0)=>{const xy=Array.create('int',2);const native=view.nativeViewProtected as android.view.View;native.getLocationInWindow(xy);return{x:xy[0]+native.getWidth()/2,y:xy[1]+native.getHeight()/2+dy*Screen.mainScreen.scale};};
  const stick=center(game.stick,-44),jump=center(game.jump),decor=(Application.android.foregroundActivity??Application.android.startActivity).getWindow().getDecorView();
  const down=android.os.SystemClock.uptimeMillis();
  const send=(action:number,points:{x:number;y:number}[])=>{
    const properties=Array.create(android.view.MotionEvent.PointerProperties,points.length),coords=Array.create(android.view.MotionEvent.PointerCoords,points.length);
    points.forEach((p,i)=>{const prop=new android.view.MotionEvent.PointerProperties();prop.id=i;prop.toolType=android.view.MotionEvent.TOOL_TYPE_FINGER;properties[i]=prop;const c=new android.view.MotionEvent.PointerCoords();c.x=p.x;c.y=p.y;c.pressure=1;c.size=1;coords[i]=c;});
    const event=android.view.MotionEvent.obtain(down,android.os.SystemClock.uptimeMillis(),action,points.length,properties,coords,0,0,1,1,0,0,android.view.InputDevice.SOURCE_TOUCHSCREEN,0);try{decor.dispatchTouchEvent(event);}finally{event.recycle();}
  };
  const trace:unknown[]=[];const touch=(e:any)=>trace.push({view:e.object.id,action:e.action,x:e.getX(),y:e.getY(),held:game.session!.held});const tap=()=>trace.push({tap:true,held:game.session!.held,moving:game.scene!.moving,airborne:game.scene!.airborne});game.stick.on('touch',touch);game.jump.on('touch',touch);game.jump.on('tap',tap);
  const before=game.session!.state.moves,start=game.session!.history.length;
  try{send(android.view.MotionEvent.ACTION_DOWN,[stick]);await wait(220);send(android.view.MotionEvent.ACTION_POINTER_DOWN|(1<<8),[stick,jump]);await wait(80);send(android.view.MotionEvent.ACTION_POINTER_UP|(1<<8),[stick,jump]);await wait(1000);send(android.view.MotionEvent.ACTION_UP,[stick]);await wait(500);
    report('multi-touch-result',{before,after:game.session!.state.moves,held:game.session!.held,trace,history:game.session!.history.slice(start).map(h=>({jump:h.jump,pos:h.state.player.pos})),stick,jump});
    return game.session!.state.moves>before&&game.session!.held===null&&game.session!.history.slice(start).some(h=>h.jump);
  }finally{send(android.view.MotionEvent.ACTION_CANCEL,[stick]);game.releaseStick();game.stick.off('touch',touch);game.jump.off('touch',touch);game.jump.off('tap',tap);}
}
