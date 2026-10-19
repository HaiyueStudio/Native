import { same } from './data';
import { Application, Button, Color, FlexboxLayout, GridLayout, Image, Label, LayoutBase, Page, Screen, ScrollView, StackLayout, TextField, TextView, View, isIOS } from '@nativescript/core';
import { HY_COMPONENTS, HYPlatformViewController, HYUIError, hyValidateProps } from '@haiyue/ui/core';
import type { HYCapabilities, HYMutation, HYNode, HYRenderer, HYTheme, HYUIEvent } from '@haiyue/ui/core';
import { hyNativeTheme } from '@haiyue/ui/portable';
import { createControl, type Control } from './controls';
import { assertMainThread, focusNative, observeKeyboard, setClipping, systemIcon } from './platform';
import type { HYNativeDiagnostics, HYNativeEnvironment, HYNativeScriptOptions } from './types';

interface Entry {
  node: HYNode; view: View; content?: LayoutBase; parent: string | null | undefined; slot?: string;
  control?: Control; off: Set<() => void>; platform?: HYPlatformViewController; platformMounted: boolean;
  accessibility?: {label:string;hint:string;role:any;state:any;value:string|undefined;text:string|undefined};
  label?: Label; error?: Label; dialogShown: boolean; closing: boolean; bindings: boolean; styled?: boolean; clip?: boolean;
}
const defaultTheme: HYTheme = {
  color: {text:'#18233D',muted:'#68748C',surface:'#F7F9FC',input:'#FFFFFF',accent:'#345AE8',danger:'#C93248',border:'#CAD3E3',focus:'#345AE8'},
  fontSize:16,lineHeight:24,gap:12,radius:8,
};

const accessibilityRoles:Record<string,string>={button:'button',text:'text',textbox:'none',checkbox:'checkbox',tab:'button',dialog:'none',image:'image',slider:'adjustable',list:'none',tree:'none'};
const align = {start:'flex-start',end:'flex-end',center:'center',stretch:'stretch'} as const;
const hAlign = {start:'left',end:'right',center:'center',stretch:'stretch'} as const;

/** A synchronous renderer: call HYPage on NativeScript's main JS/UI thread. Owns only its child root. */
export class HYNativeScriptRenderer implements HYRenderer {
  readonly capabilities: HYCapabilities = Object.freeze({contract:1,backend:'nativescript',components:HY_COMPONENTS,
    features:Object.freeze(['text.composition','text.selection','text.secure','accessibility','motion.reduced',...(isIOS?['icons.system']:[])])});
  readonly #root = new GridLayout(); readonly #nodes = new Map<string,Entry>(); readonly #off = new Set<() => void>();
  readonly #order = new Map<string|null,string[]>();
  #emit?: (event:HYUIEvent)=>void; #mounted=false; #disposed=false; #suspended=false; #applying=false;
  #relationsDirty=false;
  #revision=0; #failed?:Error; #focus?:string; #pendingFocus?:string; #keyboardOff?:()=>void; #keyboardHeight=0;
  #environment:HYNativeEnvironment; #theme:HYTheme; #timer?:ReturnType<typeof setTimeout>;
  #counts={commits:0,created:0,updated:0,moved:0,removed:0,activeListeners:0};
  constructor(private readonly host:LayoutBase,private readonly options:HYNativeScriptOptions={}) {
    assertMainThread(); this.#environment=options.environment??{}; this.#theme=hyNativeTheme(this.#environment.theme??defaultTheme,this.#environment.fontScale??1);
    this.#root.iosOverflowSafeArea=options.safeArea==='host';
    this.#root.backgroundColor=new Color(this.#theme.color.surface);
  }
  get diagnostics():HYNativeDiagnostics { return Object.freeze({...this.#counts,activeNodes:this.#nodes.size,
    activeResources:[...this.#nodes.values()].filter(e=>e.platformMounted).length,activeTimers:this.#timer===undefined?0:1}); }
  mount(emit:(event:HYUIEvent)=>void):void {
    assertMainThread(); if(this.#mounted||this.#disposed)throw new HYUIError('lifecycle','Native renderer already mounted or disposed');
    this.#mounted=true;this.#emit=emit;
    this.#listen(this.#off,this.#root,'loaded',()=>this.#loaded());
    this.#listen(this.#off,this.#root,'unloaded',()=>{this.#keyboardOff?.();this.#keyboardOff=undefined;});
    this.#listen(this.#off,this.#root,'layoutChanged',()=>this.#scheduleLayout());
    this.#application(Application.suspendEvent,()=>this.suspend());
    this.#application(Application.resumeEvent,()=>this.resume());
    this.#application(Application.systemAppearanceChangedEvent,()=>this.#scheduleLayout());
    if(!isIOS) {
      const back=(args:any)=>{if(this.#disposed||this.#suspended||!this.#root.isLoaded||args.cancel)return;
        const modal=[...this.#nodes.values()].reverse().find(e=>e.node.kind==='Dialog'&&e.node.props.open);
        if(modal){args.cancel=true;if(modal.node.kind==='Dialog'&&modal.node.props.dismissible!==false)this.#event(modal,{key:modal.node.key,type:'cancel',reason:'keyboard',transaction:0});}
        else args.cancel=this.options.onBack?.()??false;
      };
      Application.android.on('activityBackPressed',back);
      this.#owned(this.#off,()=>Application.android.off('activityBackPressed',back));
    }
    this.host.addChild(this.#root);
  }
  #owned(set:Set<()=>void>,off:()=>void):()=>void {
    let active=true;this.#counts.activeListeners++;
    const release=()=>{if(!active)return;active=false;set.delete(release);this.#counts.activeListeners--;off();};set.add(release);return release;
  }
  #listen(set:Set<()=>void>,view:View,name:string,callback:(event:any)=>void):()=>void {view.on(name,callback);return this.#owned(set,()=>view.off(name,callback));}
  #application(name:string,callback:()=>void):void {Application.on(name,callback);this.#owned(this.#off,()=>Application.off(name,callback));}
  #loaded():void {
    if(this.#disposed)return;
    this.#keyboardOff?.();
    this.#keyboardOff=this.#owned(this.#off,observeKeyboard(this.#root,height=>{
      if(this.#disposed||height===this.#keyboardHeight)return;
      this.#keyboardHeight=height;
      // Android's adjustResize owns keyboard avoidance. UIKit needs only overlap of the safe-area root.
      if(isIOS)this.#root.paddingBottom=height;
      this.#scheduleLayout();
    }));
    this.#syncDialogs();this.#scheduleLayout();
  }
  #ready():void {assertMainThread();if(this.#failed)throw this.#failed;if(!this.#mounted||this.#disposed)throw new HYUIError('lifecycle','Native renderer is not mounted');}
  commit(revision:number,mutations:readonly HYMutation[]):void {
    this.#ready();if(this.#applying||!Number.isSafeInteger(revision)||revision<=this.#revision)throw new HYUIError('lifecycle','Non-monotonic or reentrant native commit',{revision});
    this.#applying=true;let current:HYMutation|undefined,layoutRequired=false;
    try {
      for(const mutation of mutations){current=mutation;this.#mutate(mutation,revision);}
      current=undefined;
      layoutRequired=this.#relationsDirty;
      if(this.#relationsDirty){this.#relations();this.#syncDialogs();this.#relationsDirty=false;}
      this.#revision=revision;this.#counts.commits++;
    } catch(cause) {
      const key=current?('node'in current?current.node.key:current.key):'<page>';
      this.#failed=new HYUIError('renderer','Native mutation failed',{key,operation:current?.type??'finalize',revision,
        ...(cause instanceof HYUIError?cause.context:{})},cause);throw this.#failed;
    } finally {this.#applying=false;}
    // Native layoutChanged/loaded still report intrinsic-size changes. A value
    // update with unchanged geometry does not need another zero-delay timer
    // and a scan of every view in the fragment.
    if(layoutRequired)this.#scheduleLayout();
  }
  #get(key:string):Entry {const entry=this.#nodes.get(key);if(!entry)throw new HYUIError('invalid-props','Unknown native key',{key});return entry;}
  #mutate(m:HYMutation,revision:number):void {
    if(m.type!=='update')this.#relationsDirty=true;
    if(m.type==='create') {
      if(this.#nodes.has(m.node.key))throw new HYUIError('duplicate-key','Duplicate native key');
      const e=this.#create(m.node,revision);this.#update(e,m.node,revision);this.#counts.created++;return;
    }
    if(m.type==='update'){const e=this.#get(m.node.key);if(e.node.kind!==m.node.kind)throw new Error('Kind changes require remove/create');this.#update(e,m.node,revision);this.#counts.updated++;return;}
    const e=this.#get(m.key);if(m.type==='remove'){this.#remove(e);return;}
    if((m.type==='insert')!==(e.parent===undefined))throw new Error('Invalid native placement lifecycle');
    const parent=m.parent===null?undefined:this.#get(m.parent);
    if(!parent&&m.slot!==undefined)throw new Error('Root cannot have a named slot');
    let ancestor=parent;while(ancestor){if(ancestor===e)throw new Error('Cyclic native placement');ancestor=ancestor.parent?this.#get(ancestor.parent):undefined;}
    if(m.before!==null){const anchor=this.#get(m.before);if(anchor.parent!==m.parent||anchor.slot!==m.slot)throw new Error('Invalid placement anchor');}
    if(parent?.node.kind==='Tabs'&&(m.slot===undefined||!parent.node.props.options.some(o=>o.value===m.slot)))throw new Error('Tabs children require an option-valued slot');
    if(parent?.node.kind==='Dialog'&&m.slot!==undefined&&m.slot!=='footer')throw new Error('Dialog supports only the footer slot');
    const content=parent?parent.content:this.#root;
    if(!content)throw new HYUIError('capability','This native control cannot contain children; use a layout or PlatformView',{key:parent?.node.key});
    if(e.parent!==undefined){const old=this.#order.get(e.parent)!;old.splice(old.indexOf(m.key),1);}
    const order=this.#order.get(m.parent)??[];this.#order.set(m.parent,order);
    const index=m.before===null?order.length:order.indexOf(m.before);order.splice(index,0,m.key);e.parent=m.parent;e.slot=m.slot;
    // Dialog roots live in UIKit/Android modal windows, not as empty layout placeholders.
    if(e.node.kind!=='Dialog') {
      if(e.view.parent instanceof LayoutBase)e.view.parent.removeChild(e.view);
      const preceding=order.slice(0,index).filter(k=>this.#get(k).node.kind!=='Dialog').length;
      content.insertChild(e.view,preceding+(parent?.node.kind==='FormGroup'||parent?.node.kind==='Dialog'?1:0));
    }
    if(m.type==='move'){this.#counts.moved++;if(this.#focus===e.node.key)this.#pendingFocus=e.node.key;}
  }
  #create(node:HYNode,revision:number):Entry {
    const e:Entry={node,view:undefined!,parent:undefined,off:new Set(),platformMounted:false,dialogShown:false,closing:false,bindings:false};
    this.#nodes.set(node.key,e); // Own failed construction too.
    e.control=createControl(node,{keyboardDismissLabel:this.options.keyboardDismissLabel,emit:event=>this.#event(e,event),enabled:()=>this.#interactive(e),
      listen:(view,name,callback)=>this.#listen(e.off,view,name,callback),error:error=>this.#asyncError(error)},revision);
    if(e.control)e.view=e.control.view;
    if(node.kind==='Tabs') {
      const wrapper=new GridLayout();wrapper.rows='auto,*';wrapper.addChild(e.view);e.content=new StackLayout();GridLayout.setRow(e.content,1);wrapper.addChild(e.content);e.view=wrapper;
    } else if(!e.view) {
      if(node.kind==='Row'||node.kind==='Column'){const flex=new FlexboxLayout();flex.flexDirection=node.kind==='Row'?'row':'column';e.view=flex;e.content=flex;}
      else if(node.kind==='Text'){e.view=new Label();}
      else if(node.kind==='Image'||node.kind==='Icon'){e.view=new Image();}
      else if(node.kind==='Scroll'){const scroll=new ScrollView();e.content=new FlexboxLayout();(e.content as FlexboxLayout).flexDirection=node.props.axis==='vertical'?'column':'row';scroll.content=e.content;e.view=scroll;}
      else if(node.kind==='FormGroup'||node.kind==='Dialog') {
        const stack=new StackLayout();e.content=stack;e.view=stack;e.label=new Label();e.label.textWrap=true;stack.addChild(e.label);
        if(node.kind==='FormGroup'){e.error=new Label();e.error.textWrap=true;stack.addChild(e.error);}
        else {const page=new Page();page.actionBarHidden=true;page.content=stack;e.view=page;}
      } else {e.content=new GridLayout();e.view=e.content;}
    }
    e.view.id=node.key;e.view.accessibilityIdentifier=node.key;e.view.iosOverflowSafeArea=false;
    this.#listen(e.off,e.view,'loaded',()=>{
      if(this.#disposed)return;e.control?.loaded();e.bindings=true;
      this.#applyNative(e,true);this.#mountPlatform(e);this.#scheduleLayout();
    });
    this.#listen(e.off,e.view,'unloaded',()=>{e.bindings=false;e.control?.unloaded();e.platform?.suspend();});
    this.#listen(e.off,e.view,'layoutChanged',()=>this.#scheduleLayout());
    if(node.kind==='PlatformView') {
      const factory=this.options.platformViews?.[node.props.slot];if(!factory)throw new HYUIError('capability',`Missing native PlatformView factory: ${node.props.slot}`,{key:node.key});
      e.platform=new HYPlatformViewController(()=>factory(e.content!,{key:node.key,slot:node.props.slot}),node.props.resourceId,node.props.visible!==false);
    }
    return e;
  }
  #update(e:Entry,node:HYNode,revision:number):void {
    hyValidateProps(node.kind,node.props,{key:node.key,...(node.source?{source:node.source}:{})},this.capabilities);
    const previous=e.node;
    const layoutChanged=!e.styled||!same(previous.props.layout,node.props.layout);
    this.#relationsDirty ||= layoutChanged||previous.props.visible!==node.props.visible
      ||!same(previous.props.a11y,node.props.a11y)
      ||node.kind==='FormGroup'||node.kind==='Tabs'||node.kind==='Dialog';
    if(node.kind==='PlatformView'&&previous.kind==='PlatformView'&&previous.props.slot!==node.props.slot)throw new Error('PlatformView slot is immutable; use a new key');
    e.node=node;e.control?.update(node,revision);
    if(node.kind==='Text'){(e.view as Label).text=node.props.text;(e.view as Label).textWrap=node.props.wrap!==false;}
    if(node.kind==='Scroll'){(e.view as ScrollView).orientation=node.props.axis;(e.content as FlexboxLayout).flexDirection=node.props.axis==='vertical'?'column':'row';}
    if(node.kind==='FormGroup'){e.label!.text=node.props.label;e.error!.text=node.props.error??'';e.error!.visibility=node.props.error?'visible':'collapse';}
    if(node.kind==='Dialog')e.label!.text=node.props.title;
    if(node.kind==='PlatformView')e.platform!.update(node.props.resourceId);
    if(node.kind==='Image'||node.kind==='Icon') {
      // Resolve fallbacks even when the platform does not have the requested system symbol.
      const image=node.kind==='Icon'&&node.props.systemName?systemIcon(node.props.systemName):undefined;
      const source=image??this.options.resolveResource?.(node.props.resource,{key:node.key,kind:node.kind});
      if(!source)throw new HYUIError('capability',`Unresolved native resource: ${node.props.resource.id}`,{key:node.key});
      (e.view as Image).src=source;(e.view as Image).stretch=node.kind==='Image'&&node.props.fit==='cover'?'aspectFill':'aspectFit';
    }
    // Android derives contentDescription synchronously from label + current text.
    // Apply accessibility after text so it cannot retain the previous render's value.
    if(layoutChanged||previous.props.a11y?.error!==node.props.a11y?.error)this.#style(e);
    this.#accessibility(e);
    if(e.view.isLoaded)this.#applyNative(e);
  }
  #style(e:Entry):void {
    const {view,node}=e,p=node.props,l=p.layout??{},theme=this.#theme;
    // NativeScript property setters cache until initNativeView; never write private nativeView fields.
    view.width=l.width??'auto';view.height=l.height??'auto';view.minWidth=l.minWidth??0;view.minHeight=l.minHeight??(['Button','Select','Toggle','TextInput','Slider'].includes(node.kind)?44:0);
    view.maxWidth=l.maxWidth??'auto';view.maxHeight=l.maxHeight??'auto';
    // Page owns the native modal controller; its content owns padding (Page does not lay it out).
    const padding=l.padding??(node.kind==='Dialog'?[20,20,20,20]:[0,0,0,0]);
    const paddingStyle=node.kind==='Dialog'?e.content!.style:view.style;
    [paddingStyle.paddingTop,paddingStyle.paddingRight,paddingStyle.paddingBottom,paddingStyle.paddingLeft]=padding;
    view.horizontalAlignment=hAlign[l.align??'stretch'];
    // Inherited typography also reaches system buttons created inside Tabs / FormGroup.
    view.style.fontSize=theme.fontSize;view.style.color=new Color(theme.color.text);
    FlexboxLayout.setFlexGrow(view,l.grow??0);FlexboxLayout.setFlexShrink(view,0);FlexboxLayout.setAlignSelf(view,align[l.align??'stretch']);
    if(view instanceof FlexboxLayout){view.alignItems=align[l.align??'stretch'];view.gap=l.gap??0;}
    if(node.kind==='Scroll'&&e.content instanceof FlexboxLayout)e.content.gap=l.gap??0;
    if(node.kind==='Tabs')(view as GridLayout).rows=l.grow||typeof l.height==='number'?'auto,*':'auto,auto';
    if(node.kind==='Grid'){
      const tracks=(values:typeof l.rows)=>values?.flatMap((v,i)=>[...(i&&l.gap?[String(l.gap)]:[]),typeof v==='object'?`${v.grow}*`:String(v)]).join(',')??'*';
      (view as GridLayout).rows=tracks(l.rows);(view as GridLayout).columns=tracks(l.columns);
    }
    const textView=e.control?.view??view;
    if(textView instanceof Label||textView instanceof Button||textView instanceof TextField||textView instanceof TextView) {
      textView.fontSize=theme.fontSize;textView.color=new Color(theme.color.text);
      textView.iosAccessibilityAdjustsFontSize=this.#environment.fontScale===undefined;
      textView.lineHeight=theme.lineHeight-theme.fontSize;
    }
    if(textView instanceof TextField||textView instanceof TextView){textView.backgroundColor=new Color(theme.color.input);textView.borderColor=new Color(p.a11y?.error?theme.color.danger:theme.color.border);textView.borderWidth=1;textView.borderRadius=theme.radius;}
    if(e.label){e.label.fontSize=theme.fontSize;e.label.color=new Color(theme.color.text);e.label.iosAccessibilityAdjustsFontSize=this.#environment.fontScale===undefined;}
    if(e.error){e.error.fontSize=theme.fontSize;e.error.color=new Color(theme.color.danger);e.error.accessibilityLiveRegion='polite';}
    if(node.kind==='Dialog')view.backgroundColor=new Color(theme.color.surface);
    e.styled=true;
  }
  #accessibility(e:Entry):void {
    const {view,node}=e,p=node.props,a=p.a11y;
    const parent=e.parent?this.#nodes.get(e.parent):undefined;
    const label=a?.label??(parent?.node.kind==='FormGroup'?parent.node.props.label:'text'in p?p.text:'resource'in p?p.resource.alt:'');
    const hint=[a?.description,a?.error,...(parent?.node.kind==='FormGroup'?[parent.node.props.error]:[])].filter(Boolean).join('. ');
    const role=a?.role?accessibilityRoles[a.role]:undefined;
    const state='disabled'in p&&p.disabled?'disabled':'checked'in p?(p.checked?'checked':'unchecked'):undefined;
    // Leave editable/secure text to the OS; an empty override hides UIKit's actual value.
    const hasValue='value'in p&&node.kind!=='TextInput'&&node.kind!=='TextArea';
    const value=hasValue?String(p.value):undefined;
    const text='text'in p?p.text:e.control?.view instanceof Button?e.control.view.text:undefined;
    const before=e.accessibility;
    // Android derives contentDescription from label + button text, so refresh
    // its label after a text change even when the semantic label is unchanged.
    if(!before||before.label!==label||(!isIOS&&before.text!==text))view.accessibilityLabel=label;
    if(!before||before.hint!==hint)view.accessibilityHint=hint;
    if(!before||before.role!==role)view.accessibilityRole=role as any;
    if(!before||before.state!==state)view.accessibilityState=state;
    if(value!==undefined&&(!before||before.value!==value))view.accessibilityValue=value;
    if(before){before.label=label;before.hint=hint;before.role=role;before.state=state;before.value=value;before.text=text;}
    else e.accessibility={label,hint,role,state,value,text};
  }
  #applyNative(e:Entry,force=false):void {const clip=!!e.node.props.layout?.clip;if(force||e.clip!==clip){setClipping(e.view,clip);e.clip=clip;}}
  #shown(e:Entry):boolean {
    let current:Entry|undefined=e;
    while(current){if(current.node.props.visible===false||(current.node.kind==='Dialog'&&!current.node.props.open))return false;
      const parent:Entry|undefined=current.parent?this.#nodes.get(current.parent):undefined;
      if(parent?.node.kind==='Tabs'&&current.slot!==parent.node.props.value)return false;current=parent;}
    return e.parent!==undefined;
  }
  #interactive(e:Entry):boolean {
    if(this.#disposed||this.#suspended||this.#applying||this.#failed||!this.#nodes.has(e.node.key)||!this.#shown(e))return false;
    let current:Entry|undefined=e;
    while(current){const p=current.node.props;if(('disabled'in p&&p.disabled)||('busy'in p&&p.busy))return false;current=current.parent?this.#nodes.get(current.parent):undefined;}return true;
  }
  #event(e:Entry,event:HYUIEvent):void {
    if(!this.#interactive(e))return;
    if(event.type==='focus')this.#focus=e.node.key;
    if((e.node.kind==='TextInput'||e.node.kind==='TextArea')&&(event.type==='focus'||event.type==='blur')) {
      e.view.style.borderColor=new Color(e.node.props.a11y?.error?this.#theme.color.danger:event.type==='focus'?this.#theme.color.focus:this.#theme.color.border);
    }
    this.#emit?.(event);
  }
  #relations():void {
    for(const e of this.#nodes.values()) {
      const shown=this.#shown(e);e.view.visibility=shown?'visible':'collapse';e.view.accessibilityHidden=!shown;
      const parent=e.parent?this.#nodes.get(e.parent):undefined,l=e.node.props.layout;
      if(parent?.node.kind==='Overlay')e.view.verticalAlignment=({start:'top',end:'bottom',center:'middle',stretch:'stretch'} as const)[l?.align??'stretch'];
      const gap=parent?.node.props.layout?.gap??0;
      GridLayout.setRow(e.view,(l?.row??0)*(parent?.node.kind==='Grid'&&gap?2:1));
      GridLayout.setColumn(e.view,(l?.column??0)*(parent?.node.kind==='Grid'&&gap?2:1));
      if(parent?.node.kind==='FormGroup'||parent?.node.kind==='Dialog'){
        e.view.marginTop=gap;
        if(parent.node.kind==='FormGroup') {
          if(!e.node.props.a11y?.label)e.view.accessibilityLabel=parent.node.props.label;
          e.view.accessibilityHint=[e.node.props.a11y?.description,e.node.props.a11y?.error,parent.node.props.error].filter(Boolean).join('. ');
        }
      }
      e.platform?.visible(shown);if(this.#suspended)e.platform?.suspend();else if(e.view.isLoaded)e.platform?.resume();
    }
  }
  #syncDialogs():void {
    if(!this.#root.isLoaded||this.#disposed)return;
    let owner:View=this.#root;
    for(const e of this.#nodes.values())if(e.node.kind==='Dialog') {
      const wanted=this.#shown(e);
      if(!wanted&&e.dialogShown&&!e.closing){e.closing=true;e.view.closeModal();}
      else if(wanted&&!e.dialogShown&&!e.closing&&!this.#suspended){
        e.dialogShown=true;const key=e.node.key;
        owner.showModal(e.view,{fullscreen:true,animated:false,cancelable:e.node.props.dismissible!==false,
          closeCallback:()=>{
            const user=e.dialogShown&&!e.closing&&!this.#disposed;e.dialogShown=false;e.closing=false;
            if(user)this.#event(e,{key,type:'cancel',reason:'keyboard',transaction:0});
            this.#scheduleLayout();
          }});
      }
      if(e.dialogShown)owner=e.view;
    }
  }
  #mountPlatform(e:Entry):void {if(e.platform&&!e.platformMounted){e.platform.mount();e.platformMounted=true;}if(e.platform){e.platform.visible(this.#shown(e));this.#suspended?e.platform.suspend():e.platform.resume();}}
  #scheduleLayout():void {
    if(this.#disposed||this.#timer!==undefined)return;
    this.#timer=setTimeout(()=>{
      this.#timer=undefined;if(this.#disposed)return;
      try {this.#syncDialogs();for(const e of this.#nodes.values())if(e.view.isLoaded){
        // Android clip bounds contain the current native dimensions. A hidden
        // view can load at 0x0, then become visible without any props change.
        this.#applyNative(e,e.node.props.layout?.clip===true);
        if(e.platformMounted){const size=e.view.getActualSize(),point=e.view.getLocationInWindow();if(point)e.platform!.layout({...point,...size,scale:Screen.mainScreen.scale});}
      }
      if(this.#pendingFocus){const e=this.#nodes.get(this.#pendingFocus);if(e?.view.isLoaded&&this.#shown(e)){this.#pendingFocus=undefined;focusNative(e.control?.view??e.view);}}
      const size=this.#root.getActualSize();this.options.onEnvironment?.({...size,scale:Screen.mainScreen.scale,keyboardHeight:this.#keyboardHeight});
      }catch(error){this.#asyncError(error as Error);}
    },0);
  }
  #asyncError(error:Error):void {this.#failed=error;this.options.onError?.(error);if(!this.options.onError)console.error('[HYNativeUI]',error);}
  focus(key:string):void {this.#ready();const e=this.#get(key);this.#focus=key;this.#pendingFocus=key;if(e.platformMounted)e.platform?.focus();this.#scheduleLayout();}
  setEnvironment(environment:HYNativeEnvironment):void {
    assertMainThread();if(this.#disposed)throw new HYUIError('lifecycle','Native renderer disposed');
    if(same(environment,this.#environment))return;
    const theme=hyNativeTheme(environment.theme??defaultTheme,environment.fontScale??1);this.#environment=environment;this.#theme=theme;
    this.#root.backgroundColor=new Color(theme.color.surface);for(const e of this.#nodes.values())this.#style(e);this.#scheduleLayout();
  }
  suspend():void {assertMainThread();if(this.#disposed||this.#suspended)return;this.#suspended=true;for(const e of this.#nodes.values()){e.control?.suspend();e.platform?.suspend();}}
  resume():void {assertMainThread();if(this.#disposed||!this.#suspended)return;this.#suspended=false;this.#relations();this.#scheduleLayout();}
  #remove(e:Entry):void {
    const errors:unknown[]=[];const release=(run:()=>void)=>{try{run();}catch(error){errors.push(error);}};
    for(const key of [...(this.#order.get(e.node.key)??[])])release(()=>this.#remove(this.#get(key)));this.#order.delete(e.node.key);
    release(()=>e.control?.dispose());release(()=>e.platform?.dispose());e.platformMounted=false;
    for(const off of [...e.off])release(off);
    if(e.dialogShown){e.closing=true;e.dialogShown=false;release(()=>e.view.closeModal());}
    if(e.view?.parent instanceof LayoutBase){const parent=e.view.parent;release(()=>parent.removeChild(e.view));}
    if(e.parent!==undefined){const order=this.#order.get(e.parent);if(order)order.splice(order.indexOf(e.node.key),1);}
    this.#nodes.delete(e.node.key);this.#counts.removed++;
    if(errors.length)throw errors[0];
  }
  dispose():void {
    assertMainThread();if(this.#disposed)return;this.#disposed=true;this.#emit=undefined;
    if(this.#timer!==undefined)clearTimeout(this.#timer);this.#timer=undefined;
    // Continue releasing siblings even if a product-owned PlatformView disposer throws.
    const errors:unknown[]=[];for(const e of [...this.#nodes.values()])if(this.#nodes.has(e.node.key)){try{this.#remove(e);}catch(error){errors.push(error);}}
    for(const off of [...this.#off]){try{off();}catch(error){errors.push(error);}}
    this.#keyboardOff=undefined;if(this.#root.parent===this.host)this.host.removeChild(this.#root);
    this.#nodes.clear();this.#order.clear();if(errors.length)throw new HYUIError('renderer','Native disposal failed',{},errors[0]);
  }
}
