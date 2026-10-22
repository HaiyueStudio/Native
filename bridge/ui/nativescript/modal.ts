import { observeKeyboard } from './platform';
import { Color, GridLayout, Page, ScrollView, isIOS, type LayoutBase, type View } from '@nativescript/core';
/** A native modal window with a centered, scrollable card. The caller owns all
 * listeners through its normal cleanup scope and controls dismissal. */
export function createModalSurface(content: LayoutBase, listen:(view:View,name:string,callback:(event:any)=>void)=>unknown,
  cancel:()=>void, maxHeight:()=>number=()=>Infinity, selection?: {anchor:View; presentation?:'auto'|'popover'|'sheet'}, surface?:{kind:'dialog'|'drawer'|'sheet';width?:number;height?:number;keyboardHeight():number}) {
  const page=new Page(),overlay=new GridLayout(),card=new ScrollView();
  overlay.iosOverflowSafeArea=false;card.iosOverflowSafeArea=false;
  page.actionBarHidden=true;page.content=overlay;page.backgroundColor=new Color('rgba(0,0,0,0.72)');overlay.padding=16;
  card.content=content;card.width='100%';card.maxWidth=460;card.horizontalAlignment='center';card.verticalAlignment='middle';overlay.addChild(card);
  let keyboardHeight=0,keyboardOff:(()=>void)|undefined;
  let previous=0,timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
  const position=()=>{
    if(disposed)return;
    if(surface) {
      const bounds=overlay.getActualSize(),inset=surface.kind==='drawer'?0:16,available=Math.max(44,bounds.height-Math.max(keyboardHeight,surface.keyboardHeight())-inset*2);
      if(bounds.width<=32||bounds.height<=64)return;
      overlay.padding=inset;card.margin=0;card.width=Math.max(44,Math.min(surface.width??(surface.kind==='drawer'?590:560),bounds.width-(surface.kind==='drawer'?16:32)));card.maxWidth=card.width;
      card.height=surface.kind==='drawer'?available:Math.min(surface.height??620,available);card.maxHeight=available;
      // ScrollView measures content unbounded even when scrolling is disabled.
      // Bound the shell so its star body cannot push the pinned footer below the viewport.
      content.height=card.height;content.width='100%';
      card.horizontalAlignment=surface.kind==='drawer'?'right':'center';card.verticalAlignment=surface.kind==='dialog'?'middle':surface.kind==='drawer'?'top':'bottom';
      if(Math.max(keyboardHeight,surface.keyboardHeight())>0)card.verticalAlignment='top';
      return;
    }
    if(selection) {
      const actual=overlay.getActualSize(),bounds={...actual,height:actual.height-keyboardHeight},anchor=selection.anchor.getLocationInWindow(),origin=overlay.getLocationInWindow();
      if(bounds.width<=32||bounds.height<=64)return;
      const wide=bounds.width>=600, popover=selection.presentation==='popover'||(selection.presentation!=='sheet'&&wide);
      page.backgroundColor=new Color('rgba(0,0,0,0.32)');
      if(popover&&anchor&&origin) {
        const width=Math.min(320,Math.max(220,selection.anchor.getActualSize().width),bounds.width-32);
        card.width=width;card.maxWidth=width;card.horizontalAlignment='left';card.verticalAlignment='top';
        const desired=content.getActualSize().height||Math.min(400,bounds.height/2),height=Math.min(desired,400,bounds.height-32);
        card.marginLeft=Math.max(0,Math.min(bounds.width-width-32,anchor.x-origin.x-16));
        const below=anchor.y-origin.y+selection.anchor.getActualSize().height+6;
        card.marginTop=Math.max(0,Math.min(bounds.height-height-32,below+height>bounds.height-16?anchor.y-origin.y-height-6:below)-16);
        card.maxHeight=height;
      } else {
        card.width='100%';card.maxWidth=590;card.horizontalAlignment='center';card.verticalAlignment='bottom';card.marginLeft=0;card.marginTop=0;card.maxHeight=Math.max(44,bounds.height-64);
      }
      return;
    }
    const height=Math.min(maxHeight(),Math.max(44,overlay.getActualSize().height-keyboardHeight-32));
    if(height!==previous){previous=height;card.maxHeight=height;}card.verticalAlignment=keyboardHeight>0?'top':'middle';
  };
  // NativeScript raises layoutChanged inside its layout pass. Mutating child
  // geometry there can be overwritten by the parent; commit on the next turn.
  const schedule=()=>{if(disposed||timer!==undefined)return;timer=setTimeout(()=>{timer=undefined;position();},0);};
  const dispose=()=>{disposed=true;keyboardOff?.();keyboardOff=undefined;if(timer!==undefined)clearTimeout(timer);timer=undefined;};
  listen(overlay,'layoutChanged',selection||surface?schedule:position);
  if(selection||surface)listen(page,'shownModally',schedule);
  listen(page,'loaded',()=>{keyboardOff?.();keyboardOff=observeKeyboard(overlay,height=>{if(isIOS){keyboardHeight=height;schedule();}});schedule();});
  listen(page,'unloaded',()=>{keyboardOff?.();keyboardOff=undefined;keyboardHeight=0;if(timer!==undefined)clearTimeout(timer);timer=undefined;});
  listen(overlay,'tap',event=>{
    const x=event.getX?.(),y=event.getY?.(),position=card.getLocationRelativeTo(overlay),size=card.getActualSize();
    if(position&&Number.isFinite(x)&&Number.isFinite(y)&&(x<position.x||x>position.x+size.width||y<position.y||y>position.y+size.height))cancel();
  });
  return {page,card,overlay,dispose,refresh:schedule};
}
