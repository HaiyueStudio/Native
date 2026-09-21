import type { Vec } from '../../../../Games/games/boxbound/model';
/** Screen-axis four-way movement, with a dead zone and diagonal hysteresis. */
export function stickDirection(x:number,y:number,previous:Vec|null=null):Vec|null {
  if(Math.hypot(x,y)<14)return null;
  const horizontal=previous?.[0] ? Math.abs(x)*1.18>=Math.abs(y) : previous?.[2] ? Math.abs(x)>Math.abs(y)*1.18 : Math.abs(x)>Math.abs(y);
  return horizontal?[Math.sign(x),0,0]:[0,0,Math.sign(y)];
}
export function stickThumb(x:number,y:number,radius=43):{x:number;y:number}{const scale=Math.min(1,radius/Math.max(1,Math.hypot(x,y)));return{x:x*scale,y:y*scale};}
