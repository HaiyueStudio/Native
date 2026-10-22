import { Color, Label, StackLayout, type View } from '@nativescript/core';
import type { HYOption, HYTheme } from '@haiyue/ui/core';
import { HYNativeButton } from './button';
import { createModalSurface } from './modal';
import { modalPresentationOptions } from './platform';
export interface HYNativeSelectionOptions { readonly value:string; readonly options:readonly HYOption[]; readonly theme:HYTheme; readonly title:string; readonly cancelLabel?:string; readonly presentation?:'auto'|'popover'|'sheet'; }
/** The result settles only after the native presentation is dismissed. Call cancel on host disposal. */
export function hyPickNativeOption(anchor:View, props:HYNativeSelectionOptions):{result:Promise<string|null>;cancel:()=>void} {
  let cancel=()=>{};
  const result=new Promise<string|null>((resolve,reject)=>{
    const panel=new StackLayout(),theme=props.theme,cleanup:(()=>void)[]=[];panel.padding=8;panel.backgroundColor=new Color(theme.color.elevated??theme.color.surface);
    const listen=(view:View,name:string,callback:(event:any)=>void)=>{view.on(name,callback);cleanup.push(()=>view.off(name,callback));};
    let settled=false,closing=false,selected:string|null=null;
    const settle=()=>{if(settled)return;settled=true;modal.dispose();cleanup.forEach(off=>off());resolve(selected);};
    const finish=(value:string|null)=>{if(closing||settled)return;closing=true;selected=value;modal.page.closeModal();};
    const modal=createModalSurface(panel,listen,()=>finish(null),()=>Infinity,{anchor,...(props.presentation?{presentation:props.presentation}:{})});
    modal.card.backgroundColor=new Color(theme.color.elevated??theme.color.surface);modal.card.borderColor=new Color(theme.color.border);modal.card.borderWidth=1;modal.card.borderRadius=theme.radius+4;
    const title=new Label();title.text=props.title;title.fontSize=theme.typography?.caption?.fontSize??12;title.color=new Color(theme.color.muted);title.padding=12;panel.addChild(title);
    for(const option of props.options){
      const button=new HYNativeButton({text:option.label,disabled:!!option.disabled,variant:option.value===props.value?'primary':'quiet'},theme);button.textAlignment='left';button.minHeight=48;button.accessibilityState=option.disabled?'disabled':option.value===props.value?'selected':undefined;
      if(option.value===props.value){button.backgroundColor=new Color(theme.color.selected??theme.color.input);button.fontWeight='bold';}
      listen(button,'tap',()=>{if(!option.disabled)finish(option.value);});panel.addChild(button);
    }
    const close=new HYNativeButton({text:props.cancelLabel??'Cancel',variant:'quiet'},theme);close.color=new Color(theme.color.muted);listen(close,'tap',()=>finish(null));panel.addChild(close);
    cancel=()=>finish(null);
    try{anchor.showModal(modal.page,{...modalPresentationOptions(),fullscreen:true,animated:false,closeCallback:settle});}catch(error){modal.dispose();cleanup.forEach(off=>off());settled=true;reject(error);}
  });
  return {result,cancel:()=>cancel()};
}
