// Property setters intentionally echo to exercise native feedback-loop suppression.
export class View {
  handlers=new Map(); style={}; isLoaded=false; isEnabled=true; isLayoutValid=true; visibility='visible'; parent=undefined;
  on(type,fn){let set=this.handlers.get(type);if(!set)this.handlers.set(type,set=new Set());set.add(fn);}
  off(type,fn){this.handlers.get(type)?.delete(fn);}
  once(type,fn){const call=e=>{this.off(type,call);fn(e);};this.on(type,call);}
  notify(type,values={}){for(const fn of [...(this.handlers.get(type)??[])])fn({object:this,eventName:type,...values});}
  load(){this.isLoaded=true;this.notify('loaded');this.children?.forEach(v=>v.load());if(this.content)this.content.load();}
  unload(){this.isLoaded=false;this.notify('unloaded');this.children?.forEach(v=>v.unload());if(this.content)this.content.unload();}
  getActualSize(){return {width:300,height:50};} getLocationInWindow(){return {x:0,y:0};} getLocationRelativeTo(){return {x:0,y:0};}
  focus(){this.focused=true;return true;} showModal(view,opts){this.modal=view;view.modalOptions=opts;view.modalOwner=this;view.load();}
  closeModal(){if(!this.modalOwner)return;this.unload();this.modalOwner.modal=undefined;this.modalOwner=undefined;this.modalOptions.closeCallback();}
}
for(const prop of ['text','value','checked'])Object.defineProperty(View.prototype,prop,{get(){return this['_'+prop]??(prop==='text'?'':prop==='value'?0:false);},set(value){if(this['_'+prop]===value)return;this['_'+prop]=value;this.notify(prop+'Change',{value});}});
export class LayoutBase extends View {
  children=[];addChild(v){this.insertChild(v,this.children.length);}
  insertChild(v,index){if(v.parent)throw Error('Already parented');this.children.splice(index,0,v);v.parent=this;if(this.isLoaded)v.load();}
  removeChild(v){const i=this.children.indexOf(v);if(i>=0){this.children.splice(i,1);if(v.isLoaded)v.unload();v.parent=undefined;}}
  getChildIndex(v){return this.children.indexOf(v);}
}
export class GridLayout extends LayoutBase {static setRow(v,n){v.row=n;}static setColumn(v,n){v.column=n;}static setColumnSpan(v,n){v.columnSpan=n;}}
export class FlexboxLayout extends LayoutBase {static setFlexGrow(v,n){v.flexGrow=n;}static setFlexShrink(v,n){v.flexShrink=n;}static setAlignSelf(v,n){v.alignSelf=n;}}
export class StackLayout extends LayoutBase {}
export class ScrollView extends View {}
export class Page extends View {}
export class Label extends View {}
export class Button extends View {}
export class Switch extends View {}
export class Slider extends View {}
export class TextField extends View {}
export class TextView extends View {}
export class Image extends View {}
export class Color {constructor(value){this.value=value;}}
export const Application=new View();Application.android=new View();Object.assign(Application,{suspendEvent:'suspend',resumeEvent:'resume',systemAppearanceChangedEvent:'appearance'});
export const Screen={mainScreen:{scale:2}};
export const isIOS=true;
export const bindings=new Set();
export const keyboardCallbacks=new Map();
export const platform={
  buttonAdornment(view,icon,busy,color){view.adornment={icon,busy,color};return ()=>{view.adornment=undefined;};},
  modalPresentationOptions(){return {ios:{presentationStyle:5}};},
  assertMainThread(){},isAccessibilityInteraction(){return false;},focusNative(v){v.focus();},systemIcon(){},setClipping(v,clip){v.clip=clip;},
  observeKeyboard(view,changed){const key={};bindings.add(key);keyboardCallbacks.set(view,changed);return ()=>{bindings.delete(key);keyboardCallbacks.delete(view);};},
  observeText(view,changed){const key={};bindings.add(key);view.composing=false;
    const read=()=>({value:view.text,composing:view.composing});
    const listener=()=>changed(read());view.on('nativeInput',listener);
    return {read,write(value){view.text=value;},dispose(){view.off('nativeInput',listener);bindings.delete(key);}};
  },
};
export function find(host,id){if(host.id===id)return host;for(const child of [...(host.children??[]),...(host.content?[host.content]:[]),...(host.modal?[host.modal]:[])]){const result=find(child,id);if(result)return result;}}
export const drain=()=>new Promise(resolve=>setTimeout(resolve,10));
