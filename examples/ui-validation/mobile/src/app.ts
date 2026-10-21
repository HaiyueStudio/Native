import {Application, Color, LayoutBase, Device, File, Frame, GridLayout, ImageSource, Label, Page, View, isIOS, knownFolders, path} from '@nativescript/core';
import {HYPage} from '@haiyue/ui/portable';
import type {HYUIEvent} from '@haiyue/ui/core';
import {HYNativeScriptRenderer} from '@haiyue/native/ui';
import {initialState,scenario} from './scenario';

const state=initialState(), events:unknown[]=[], diagnostics:unknown[]=[];
let page:HYPage,renderer:HYNativeScriptRenderer,dark=false,cyclesRunning=false,platforms=0;
const keyboardDiagnostics=()=>!isIOS?undefined:['/screen/scroll/body/name/title','/screen/scroll/body/source'].map(key=>{
  const input=frame.currentPage?.getViewById<View>(key)?.ios as UITextField|UITextView|undefined;
  const accessory=input?.inputAccessoryView;
  const bounds=accessory?.bounds;
  const position=accessory?.window?accessory.convertRectToView(accessory.bounds,null!):undefined;
  return {key,focused:input?.isFirstResponder,accessory:!!accessory,inWindow:!!accessory?.window,hidden:accessory?.hidden,width:bounds?.size.width,height:bounds?.size.height,x:position?.origin.x,y:position?.origin.y};
});
const controlStates=()=>{
  const result:unknown[]=[];
  const visit=(parent:View)=>parent.eachChildView(view=>{if(view.accessibilityIdentifier?.includes('/option-'))result.push({key:view.accessibilityIdentifier,enabled:view.isEnabled,accessible:view.accessible,state:view.accessibilityState,role:view.accessibilityRole,nativeEnabled:isIOS?view.ios?.enabled:undefined,traits:isIOS?String(view.ios?.accessibilityTraits):undefined});visit(view);return true;});
  if(frame.currentPage)visit(frame.currentPage);
  return result;
};
const report=()=>{
  const data={schema:1,controls:controlStates(),platform:Device.os,osVersion:Device.osVersion,model:Device.model,time:new Date().toISOString(),state,events:events.slice(-200),diagnostics:diagnostics.slice(-60),platforms,renderer:renderer?.diagnostics,keyboard:keyboardDiagnostics()};
  File.fromPath(path.join(knownFolders.documents().path,'ui-validation.json')).writeTextSync(JSON.stringify(data,null,2));
  console.log('[HYUI]',JSON.stringify({state,platforms,diagnostics:renderer?.diagnostics}));
};
const platformViews={
  preview:(host:LayoutBase)=>{const label=new Label();label.textWrap=true;label.backgroundColor='#213A64';label.color=new Color('white');platforms++;return {
    mount(){host.addChild(label);},update(id:string){label.text=`预览资源：${id}`;},layout(){},visible(shown:boolean){label.visibility=shown?'visible':'collapse';},focus(){label.focus();},dispose(){host.removeChild(label);platforms--;},
  };},
  editor:(host:LayoutBase)=>{const label=new Label();label.textWrap=true;label.backgroundColor='#E8EEF9';platforms++;return {
    mount(){host.addChild(label);},update(id:string){label.text=`代码编辑器端口 · ${id.length} 字符`;},layout(){},visible(shown:boolean){label.visibility=shown?'visible':'collapse';},focus(){label.focus();},dispose(){host.removeChild(label);platforms--;},
  };},
};
const image=()=>ImageSource.fromBase64Sync('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==');
const frame=new Frame();
frame.navigate({create:()=>{
  const nativePage=new Page();nativePage.actionBarHidden=true;const host=new GridLayout();nativePage.content=host;
  const options=()=>({keyboardDismissLabel:'完成',platformViews,resolveResource:image,onBack:()=>page.back(),onError:(error:Error)=>{state.status=`错误：${error.message}`;console.error(error.stack);report();}});
  const tree=()=>scenario(state,{systemIcons:renderer.capabilities.features.includes('icons.system')});
  const mount=()=>{renderer=new HYNativeScriptRenderer(host,options());page=new HYPage(renderer,{onEvent,defaultFocus:'/screen/toolbar/increment'});page.mount(tree());};
  const render=()=>page.render(tree());
  const onEvent=(event:HYUIEvent)=>{
    if(!event.key.endsWith('/password'))events.push(event);
    if(event.type==='activate') {
      if(event.key.endsWith('/catalog-toggle'))state.gallery=!state.gallery;
      if(event.key.endsWith('/expand'))state.expanded=!state.expanded;
      if(event.key.endsWith('/clear-rating'))state.rating=0;
      if(event.key.endsWith('/previous'))state.step=Math.max(0,state.step-1);
      if(event.key.endsWith('/next'))state.step=Math.min(2,state.step+1);
      const step=event.key.match(/\/step-([0-2])$/);if(step)state.step=Number(step[1]);
      if(event.key.endsWith('/increment'))state.count++;
      if(event.key.endsWith('/dialog'))state.dialog=true;
      if(event.key.endsWith('/close'))state.dialog=false;
      if(event.key.endsWith('/cycles')){void cycles();return;}
      if(event.key.endsWith('/theme')){dark=!dark;renderer.setEnvironment(dark?{fontScale:1.25,theme:{fontSize:16,lineHeight:24,gap:12,radius:8,color:{text:'#F4F6FF',muted:'#ACB9D3',surface:'#152036',input:'#273650',accent:'#8BA7FF',danger:'#FF8A95',border:'#536683',focus:'#8BA7FF'}}}:{});}
    }
    if(event.type==='cancel'&&event.key.endsWith('/modal'))state.dialog=false;
    if(event.type==='commit'){
      if(event.key.endsWith('/sections'))state.section=String(event.value);
      if(event.key.endsWith('/consent'))state.checked=!!event.value;
      if(event.key.endsWith('/mode'))state.choice=String(event.value);
      if(event.key.endsWith('/rating'))state.rating=Number(event.value);
      if(event.key.endsWith('/title'))state.title=String(event.value);
      if(event.key.endsWith('/source'))state.source=String(event.value);
      if(event.key.endsWith('/quality'))state.quality=String(event.value);
      if(event.key.endsWith('/tabs'))state.tab=String(event.value);
      if(event.key.endsWith('/enabled'))state.enabled=!!event.value;
      if(event.key.endsWith('/amount'))state.amount=Number(event.value);
    }
    if(['activate','commit','cancel'].includes(event.type)){render();report();}
  };
  const cycles=async()=>{
    if(cyclesRunning)return;cyclesRunning=true;state.dialog=false;
    for(let i=0;i<50;i++){
      page.dispose();const retired=renderer.diagnostics;diagnostics.push({cycle:i,...retired});
      if(retired.activeNodes||retired.activeListeners||retired.activeResources||retired.activeTimers||platforms)throw Error('Native UI resource leak');
      mount();await new Promise(resolve=>setTimeout(resolve,32));
    }
    state.status='50 次清理通过';cyclesRunning=false;render();report();
  };
  nativePage.once('loaded',()=>{mount();state.status='原生控件已加载';render();setTimeout(()=>{
    report();
    // Opt-in device probe for hosts whose XCTest service cannot bootstrap.
    if(isIOS&&NSProcessInfo.processInfo.arguments.containsObject('--ui-keyboard-check'))host.getViewById<View>('/screen/scroll/body/name/title')?.focus();
  },1000);});
  Application.on(Application.suspendEvent,()=>{page?.suspend();report();});
  Application.on(Application.resumeEvent,()=>page?.resume());
  return nativePage;
}});
if(isIOS)Application.ios.addNotificationObserver(UIKeyboardDidShowNotification,()=>setTimeout(()=>{
  report();
  for(const key of ['/screen/scroll/body/name/title','/screen/scroll/body/source']){
    const input=frame.currentPage?.getViewById<View>(key)?.ios as UITextField|UITextView|undefined;
    const accessory=input?.inputAccessoryView;
    if(!input?.isFirstResponder||!accessory?.window||accessory.bounds.size.width<=0)continue;
    // Capture only our accessory, never keyboard keys, candidate text or other apps.
    UIGraphicsImageRenderer.alloc().initWithSize(accessory.bounds.size).PNGDataWithActions(()=>{
      accessory.drawViewHierarchyInRectAfterScreenUpdates(accessory.bounds,true);
    }).writeToFileAtomically(path.join(knownFolders.documents().path,'keyboard-accessory.png'),true);
  }
},0));
Application.run({create:()=>frame});
