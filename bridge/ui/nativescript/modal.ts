import { Color, GridLayout, Page, ScrollView, type LayoutBase, type View } from '@nativescript/core';
/** A native modal window with a centered, scrollable card. The caller owns all
 * listeners through its normal cleanup scope and controls dismissal. */
export function createModalSurface(content: LayoutBase, listen:(view:View,name:string,callback:(event:any)=>void)=>unknown,
  cancel:()=>void, maxHeight:()=>number=()=>Infinity) {
  const page=new Page(),overlay=new GridLayout(),card=new ScrollView();
  page.actionBarHidden=true;page.content=overlay;page.backgroundColor=new Color('rgba(0,0,0,0.72)');overlay.padding=16;
  card.content=content;card.width='100%';card.maxWidth=460;card.horizontalAlignment='center';card.verticalAlignment='middle';overlay.addChild(card);
  let previous=0;
  listen(overlay,'layoutChanged',()=>{
    const height=Math.min(maxHeight(),Math.max(44,overlay.getActualSize().height-32));
    if(height!==previous){previous=height;card.maxHeight=height;}
  });
  listen(overlay,'tap',event=>{
    const x=event.getX?.(),y=event.getY?.(),position=card.getLocationRelativeTo(overlay),size=card.getActualSize();
    if(position&&Number.isFinite(x)&&Number.isFinite(y)&&(x<position.x||x>position.x+size.width||y<position.y||y>position.y+size.height))cancel();
  });
  return {page,card};
}
