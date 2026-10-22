import { Color, GridLayout, Label, Page, ScrollView, isIOS, type View } from '@nativescript/core';
import type { HYTheme } from '@haiyue/ui/core';
import { HYNativeButton } from './button';
import { createModalSurface } from './modal';
import { focusNative, modalPresentationOptions } from './platform';
export interface HYNativeOverlayOptions {
  readonly title:string; readonly content:View; readonly footer?:View; readonly theme:HYTheme;
  readonly kind?:'dialog'|'drawer'|'sheet'; readonly width?:number; readonly height?:number;
  readonly scrollable?:boolean; readonly dismissible?:boolean; readonly closeLabel?:string; readonly returnFocus?:View;
  readonly onClosed?:()=>void;
}
export interface HYNativeOverlayHandle { readonly page:Page; readonly closed:Promise<void>; close():void; setTitle(title:string,closeLabel?:string):void; }
/** Common native shell with pinned heading/actions, scrollable body and keyboard avoidance. */
export function hyShowNativeOverlay(owner:View,options:HYNativeOverlayOptions):HYNativeOverlayHandle {
  const cleanup:(()=>void)[]=[],panel=new GridLayout(),theme=options.theme,kind=options.kind??'dialog';panel.rows='auto,*,auto';panel.iosOverflowSafeArea=false;
  let closing=false,settled=false,resolveClosed:()=>void=()=>{};
  const closed=new Promise<void>(resolve=>{resolveClosed=resolve;});
  const listen=(view:View,name:string,callback:(event:any)=>void)=>{view.on(name,callback);cleanup.push(()=>view.off(name,callback));};
  const surface=createModalSurface(panel,listen,()=>{if(options.dismissible!==false)close();},()=>Infinity,undefined,{kind,...(options.width?{width:options.width}:{}),...(options.height?{height:options.height}:{}),keyboardHeight:()=>0});
  const close=()=>{if(closing||settled)return;closing=true;surface.page.closeModal();};
  const settle=()=>{if(settled)return;settled=true;surface.dispose();cleanup.splice(0).forEach(off=>off());try{options.onClosed?.();}finally{resolveClosed();if(options.returnFocus?.isLoaded)focusNative(options.returnFocus);}};
  surface.page.accessibilityLabel=options.title;surface.card.isScrollEnabled=false;surface.card.backgroundColor=new Color(theme.color.surface);surface.card.borderColor=new Color(theme.color.border);surface.card.borderWidth=1;surface.card.borderRadius=kind==='drawer'?0:theme.radius+6;
  let closeButton:HYNativeButton|undefined;const header=new GridLayout();header.iosOverflowSafeArea=false;header.columns='*,auto';header.padding=16;header.borderBottomWidth=1;header.borderColor=new Color(theme.color.border);
  const title=new Label();title.text=options.title;title.textWrap=true;title.fontSize=theme.typography?.title?.fontSize??theme.fontSize+6;title.fontWeight='bold';title.color=new Color(theme.color.text);title.verticalAlignment='middle';header.addChild(title);
  if(options.dismissible!==false){const dismiss=new HYNativeButton({text:'',icon:'close',variant:'quiet',a11y:{label:options.closeLabel??'Close'}},theme);closeButton=dismiss;dismiss.width=44;dismiss.height=44;dismiss.accessibilityIdentifier='hy-overlay-close';GridLayout.setColumn(dismiss,1);listen(dismiss,'tap',close);header.addChild(dismiss);}
  panel.addChild(header);
  const scroll=options.scrollable===false?options.content:new ScrollView();if(options.scrollable!==false)(scroll as ScrollView).content=options.content;scroll.accessibilityIdentifier='hy-overlay-body';GridLayout.setRow(scroll,1);panel.addChild(scroll);
  if(options.footer){const footer=new GridLayout();footer.iosOverflowSafeArea=false;footer.padding=12;footer.borderTopWidth=1;footer.borderColor=new Color(theme.color.border);footer.addChild(options.footer);GridLayout.setRow(footer,2);panel.addChild(footer);}
  listen(owner,'navigatingFrom',close);
  try{owner.showModal(surface.page,{...modalPresentationOptions(),fullscreen:true,animated:false,cancelable:options.dismissible!==false,closeCallback:settle});}catch(error){settle();throw error;}
  return {page:surface.page,closed,close,setTitle(value,closeLabel){title.text=value;surface.page.accessibilityLabel=value;if(closeButton&&closeLabel!==undefined)closeButton.accessibilityLabel=closeLabel;}};
}
