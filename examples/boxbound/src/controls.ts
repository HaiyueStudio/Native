import {VirtualJoystickControls, type VirtualJoystickSurface} from '@haiyue/extensions/controls';
import {OrbitPointerTarget, type LogicalRect} from '../../../bridge/input/pointer-target';
import type {Vec} from '../../../../Games/games/boxbound/model';
/** Only grid snapping is game-specific; pointer ownership, dead zone and clamp belong to the engine. */
export function stickDirection(x:number,y:number,previous:Vec|null=null):Vec|null {
  if(!x&&!y)return null;
  const horizontal=previous?.[0] ? Math.abs(x)*1.18>=Math.abs(y) : previous?.[2] ? Math.abs(x)>Math.abs(y)*1.18 : Math.abs(x)>Math.abs(y);
  return horizontal?[Math.sign(x),0,0]:[0,0,Math.sign(y)];
}
export function createStick(rect:()=>LogicalRect, enabled:(point:{x:number;y:number})=>boolean){
  const target=new OrbitPointerTarget(rect,'all');
  const joystick=new VirtualJoystickControls(target as unknown as VirtualJoystickSurface,{
    mode:'floating',showIdle:false,center:({width,height})=>({x:width/2,y:height/2}),
    region:({width,height})=>({x:0,y:64,width:width*.55,height:Math.max(0,height-64)}),
    maxDistance:43,knobRadius:29,activationRadius:73,deadZone:14/43,shouldActivate:enabled,
  });
  return{target,joystick};
}
