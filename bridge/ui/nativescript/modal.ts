import { observeKeyboard } from './platform';
import { Color, GridLayout, Page, ScrollView, isIOS, type LayoutBase, type View } from '@nativescript/core';
/** A native modal window with a centered, scrollable card. The caller owns all
 * listeners through its normal cleanup scope and controls dismissal. */
export function createModalSurface(content: LayoutBase, listen:(view:View,name:string,callback:(event:any)=>void)=>unknown,
  cancel:()=>void, maxHeight:()=>number=()=>Infinity, selection?: {anchor:View; presentation?:'auto'|'popover'|'sheet'}, surface?:{kind:'dialog'|'drawer'|'sheet';width?:number;height?:number;keyboardHeight():number}) {
  const page=new Page(),overlay=new GridLayout(),card=new ScrollView();
  overlay.iosOverflowSafeArea=false;card.iosOverflowSafeArea=false;
  page.actionBarHidden=true;page.content=overlay;page.backgroundColor=new Color(selection?'rgba(0,0,0,0.32)':'rgba(0,0,0,0.72)');overlay.padding=16;
  card.content=content;card.width='100%';card.maxWidth=460;card.horizontalAlignment='center';card.verticalAlignment='middle';overlay.addChild(card);
  // Opacity keeps the card in native measurement. Do not paint or focus its
  // provisional centered frame while an anchored/sheet layout is still pending.
  let firstLayoutPending=!!(selection||surface);
  if(firstLayoutPending){card.opacity=0;card.accessibilityHidden=true;card.isUserInteractionEnabled=false;}
  const reveal=()=>{
    if(!firstLayoutPending||!page.isLoaded)return;
    // A constraint can invalidate layout without changing the final rectangle,
    // in which case NativeScript need not emit another layoutChanged event.
    if(!overlay.isLayoutValid||!card.isLayoutValid||!content.isLayoutValid){schedule(true);return;}
    const size=card.getActualSize();if(size.width<=0||size.height<=0){schedule(true);return;}
    firstLayoutPending=false;card.opacity=1;card.accessibilityHidden=false;card.isUserInteractionEnabled=true;
  };
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
      reveal();
      return;
    }
    if(selection) {
      const actual=overlay.getActualSize(),bounds={...actual,height:actual.height-keyboardHeight},anchor=selection.anchor.getLocationInWindow(),origin=overlay.getLocationInWindow();
      if(bounds.width<=32||bounds.height<=64)return;
      const popover=selection.presentation!=='sheet';
      if(popover&&anchor&&origin) {
        const width=Math.min(360,Math.max(180,selection.anchor.getActualSize().width),bounds.width-32);
        card.width=width;card.maxWidth=width;card.horizontalAlignment='left';card.verticalAlignment='top';
        const desired=content.getActualSize().height||Math.min(400,bounds.height/2),top=anchor.y-origin.y,below=top+selection.anchor.getActualSize().height+6;
        const belowRoom=Math.max(0,bounds.height-16-below),aboveRoom=Math.max(0,Math.min(top-6,bounds.height-16)-16),under=belowRoom>=96||belowRoom>=aboveRoom;
        const height=Math.max(44,Math.min(desired,400,under?belowRoom:aboveRoom));
        card.marginLeft=Math.max(0,Math.min(bounds.width-width-32,anchor.x-origin.x-16));
        card.marginTop=Math.max(0,Math.min(bounds.height-height-16,under?below:top-height-6)-16);
        card.maxHeight=height;
      } else {
        card.width='100%';card.maxWidth=590;card.horizontalAlignment='center';card.verticalAlignment='bottom';card.marginLeft=0;card.marginTop=0;card.maxHeight=Math.max(44,bounds.height-64);
      }
      reveal();
      return;
    }
    const height=Math.min(maxHeight(),Math.max(44,overlay.getActualSize().height-keyboardHeight-32));
    if(height!==previous){previous=height;card.maxHeight=height;}card.verticalAlignment=keyboardHeight>0?'top':'middle';
  };
  // NativeScript raises layoutChanged inside its layout pass. Mutating child
  // geometry there can be overwritten by the parent; commit on the next turn.
  const schedule=(awaitLayout=false)=>{if(disposed||timer!==undefined)return;timer=setTimeout(()=>{timer=undefined;position();},awaitLayout===true?16:0);};
  const dispose=()=>{disposed=true;keyboardOff?.();keyboardOff=undefined;if(timer!==undefined)clearTimeout(timer);timer=undefined;};
  listen(overlay,'layoutChanged',selection||surface?schedule:position);
  if(selection||surface){listen(page,'shownModally',schedule);listen(card,'layoutChanged',schedule);listen(content,'layoutChanged',schedule);}
  listen(page,'loaded',()=>{keyboardOff?.();keyboardOff=observeKeyboard(overlay,height=>{if(isIOS){keyboardHeight=height;schedule();}});schedule();});
  listen(page,'unloaded',()=>{keyboardOff?.();keyboardOff=undefined;keyboardHeight=0;if(timer!==undefined)clearTimeout(timer);timer=undefined;});
  listen(overlay,'tap',event=>{
    const x=event.getX?.(),y=event.getY?.(),position=card.getLocationRelativeTo(overlay),size=card.getActualSize();
    if(position&&Number.isFinite(x)&&Number.isFinite(y)&&(x<position.x||x>position.x+size.width||y<position.y||y>position.y+size.height))cancel();
  });
  return {page,card,overlay,dispose,refresh:schedule};
}
