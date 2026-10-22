import { HYNativeButton } from './button';
import { hyPickNativeOption } from './selection';
import {createModalSurface} from './modal';
import { same } from './data';
import { Button, Color, FlexboxLayout, GridLayout, Label, ScrollView, Slider, StackLayout, Switch, TextField, TextView, View } from '@nativescript/core';
import { HYButtonController, HYSelectionController, HYSliderController, HYTextController, HYToggleController } from '@haiyue/ui/core';
import type { HYNode, HYReason, HYUIEvent, HYTheme, HYSelectionProps } from '@haiyue/ui/core';
import type { HYNativeTextHandle } from './types';
import { isAccessibilityInteraction, observeText, modalPresentationOptions } from './platform';

export interface Control {
  readonly view: View;
  update(node: HYNode, revision: number): void;
  loaded(): void; unloaded(): void; suspend(): void; dispose(): void;
}
export interface ControlContext {
  readonly keyboardDismissLabel?: string;
  readonly selectionCancelLabel?: string;
  theme(): HYTheme;
  emit(event: HYUIEvent): void;
  enabled(): boolean;
  listen(view: View, name: string, callback: (event: any) => void): () => void;
  error(error: Error): void;
}
const selectionProps=({value,options,disabled}:HYSelectionProps):HYSelectionProps=>({value,options,...(disabled===undefined?{}:{disabled})});
const reason = (): HYReason => isAccessibilityInteraction() ? 'accessibility' : 'pointer';


export function createControl(initial: HYNode, context: ControlContext, revision: number): Control | undefined {
  let writing = false, disposed = false;
  const write = (run: () => void) => { const previous = writing; writing = true; try { run(); } finally { writing = previous; } };
  const enabled = () => !writing && !disposed && context.enabled();
  const focus = () => context.emit({key:initial.key,type:'focus',reason:reason(),transaction:0});
  const listen = (view: View, event: string, callback: (event: any) => void) => context.listen(view, event, args => { if (enabled()) callback(args); });
  const base = (view: View, update: Control['update'], dispose: () => void, extra: Partial<Control> = {}): Control => ({
    view, update: (node, rev) => write(() => update(node, rev)), loaded() {}, unloaded() {}, suspend() {},
    dispose() { if (!disposed) { disposed = true; dispose(); } }, ...extra,
  });
  if(initial.kind==='Badge'||initial.kind==='Divider') {
    const view=new Label();view.textWrap=true;
    return base(view,node=>{if(node.kind==='Badge')view.text=node.props.text;if(node.kind==='Divider')view.text=node.props.text??'';},()=>{});
  }
  if(initial.kind==='Checkbox') {
    const view=new Button();let props=initial.props;
    const toggleProps=()=>({checked:props.checked,...(props.disabled===undefined?{}:{disabled:props.disabled})});
    const controller=new HYToggleController(initial.key,toggleProps(),context.emit);
    listen(view,'tap',()=>{focus();controller.choose(!props.checked,reason());});
    return base(view,node=>{if(node.kind!=='Checkbox')return;props=node.props;controller.update(toggleProps());view.text=`${props.checked?'☑':'☐'}  ${props.text}`;view.isEnabled=!props.disabled;view.opacity=props.disabled ? .45 : 1;view.accessibilityState=props.checked?'checked':'unchecked';},()=>controller.dispose());
  }
  if(initial.kind==='RadioGroup'||initial.kind==='Rate') {
    const view=new FlexboxLayout();view.flexDirection='row';view.flexWrap='wrap';view.gap=8;
    let node=initial,transaction=0,choosing=false;
    const buttons=new Map<string,{view:Button;off:()=>void}>();
    const selection=initial.kind==='RadioGroup'?new HYSelectionController(initial.key,initial.props,context.emit):undefined;
    const choose=(value:string)=>{
      if(node.props.disabled||choosing)return;
      focus();
      if(selection)selection.choose(value,reason());
      else if(node.kind==='Rate'&&!node.props.readOnly&&node.props.value!==Number(value)){
        choosing=true;const tx=++transaction;try{context.emit({key:node.key,type:'valueChange',value:Number(value),reason:reason(),transaction:tx});if(!disposed)context.emit({key:node.key,type:'commit',value:Number(value),reason:reason(),transaction:tx});}finally{choosing=false;}
      }
    };
    const update=()=>{
      const theme=context.theme(),options=node.kind==='RadioGroup'?node.props.options:Array.from({length:node.props.count},(_,i)=>({value:String(i+1),label:`${i+1} / ${node.kind==='Rate'?node.props.count:5}`}));
      for(const [key,entry] of buttons)if(!options.some(o=>o.value===key)){entry.off();view.removeChild(entry.view);buttons.delete(key);}
      options.forEach((option,index)=>{
        let entry=buttons.get(option.value);
        if(!entry){const button=new Button();entry={view:button,off:listen(button,'tap',()=>choose(option.value))};buttons.set(option.value,entry);view.addChild(button);}
        const button=entry.view,selected=node.kind==='RadioGroup'?node.props.value===option.value:Number(option.value)<=node.props.value;
        if(view.getChildIndex(button)!==index){view.removeChild(button);view.insertChild(button,index);}
        button.text=node.kind==='RadioGroup'?`${selected?'◉':'○'}  ${option.label}`:selected?'★':'☆';
        button.accessibilityIdentifier=`${initial.key}/option-${encodeURIComponent(option.value)}`;button.accessible=true;button.accessibilityLabel=option.label;button.accessibilityRole='button';
        button.isEnabled=!node.props.disabled&&!('disabled'in option&&option.disabled)&&!(node.kind==='Rate'&&node.props.readOnly);
        // NativeScript rebuilds UIKit traits from accessibilityState; isEnabled alone is insufficient.
        button.accessibilityState=!button.isEnabled?'disabled':selected?'selected':undefined;
        button.minWidth=44;button.minHeight=44;button.paddingLeft=8;button.paddingRight=8;button.margin=0;button.marginRight=8;button.textTransform='none';
        button.fontSize=theme.fontSize;button.color=new Color(selected?theme.color.accent:theme.color.text);button.backgroundColor=new Color('transparent');button.borderColor=new Color(theme.color.border);button.borderWidth=0;button.borderRadius=theme.radius;button.opacity=button.isEnabled?1:.45;
      });
    };
    return base(view,next=>{if(next.kind!=='RadioGroup'&&next.kind!=='Rate')return;node=next;if(next.kind==='RadioGroup')selection!.update(next.props);update();},()=>{selection?.dispose();for(const entry of buttons.values())entry.off();buttons.clear();});
  }
  if (initial.kind === 'Button') {
    const view = new HYNativeButton(initial.props,context.theme(),false), controller = new HYButtonController(initial.key, initial.props, context.emit);
    listen(view, 'tap', () => { focus(); controller.activate(reason()); });
    return base(view, node => { if (node.kind !== 'Button') return; controller.update(node.props); view.setPresentation(node.props,context.theme()); }, () => {view.setPresentationActive(false);controller.dispose();}, {suspend(){view.setPresentationActive(false);},loaded(){view.setPresentationActive(true);}});
  }
  if (initial.kind === 'Toggle') {
    const view = new Switch(), controller = new HYToggleController(initial.key, initial.props, context.emit);
    let props = initial.props;
    listen(view, 'checkedChange', event => {
      // Ignore stale notifications and a delayed setter echo, including after a native view is recreated.
      if (event.value !== view.checked || event.value === props.checked) return;
      focus(); controller.choose(view.checked, reason()); write(() => { view.checked = props.checked; });
    });
    return base(view, node => { if (node.kind !== 'Toggle') return; props = node.props; controller.update(props); view.checked = props.checked; view.isEnabled = !props.disabled; }, () => controller.dispose());
  }
  if (initial.kind === 'TextInput' || initial.kind === 'TextArea') {
    const view = initial.kind === 'TextInput' ? new TextField() : new TextView();
    const controller = new HYTextController(initial.key, initial.props, context.emit, initial.kind === 'TextArea', revision);
    let native: HYNativeTextHandle | undefined;
    const applyValue = () => {
      if (native) native.write(controller.value);
      else if (view.text !== controller.value) view.text = controller.value;
    };
    controller.attach({apply(state) { write(() => {
      view.hint = state.props.placeholder ?? ''; view.isEnabled = !state.props.disabled; view.editable = !state.props.readOnly;
      if (view instanceof TextField) { view.secure = !!state.props.secure; view.closeOnReturn = false; }
      // Never rewrite marked text or an identical draft: this preserves selection and native undo history.
      if (!state.composing) applyValue();
    }); }});
    const sample = () => {
      if (!enabled() || !native) return;
      const state = native.read();
      if (state.composing && !controller.composing) controller.compositionStart();
      if (!state.composing && controller.composing) controller.compositionEnd(state.value);
      else controller.input(state.value);
    };
    listen(view, 'focus', () => controller.focus());
    listen(view, 'blur', () => { sample(); controller.blur(); });
    listen(view, 'returnPress', () => {
      const composing = native?.read().composing || controller.composing;
      sample(); controller.enter(composing);
    });
    const unload = () => { native?.dispose(); native = undefined; };
    return base(view, (node, rev) => {
      if (node.kind === 'TextInput' || node.kind === 'TextArea') controller.update(node.props, rev);
    }, () => { unload(); controller.dispose(); }, {
      loaded() { if (!native && !disposed) { native = observeText(view, sample, context.keyboardDismissLabel); write(applyValue); } },
      unloaded: unload,
    });
  }
  if (initial.kind === 'Slider') {
    const view = new Slider(), controller = new HYSliderController(initial.key, initial.props, context.emit);
    let props = initial.props, tracking = false;
    const show = () => write(() => { view.value = (controller.value - props.min) / props.step; });
    listen(view, 'touch', event => {
      if (event.action === 'down') { tracking = true; focus(); }
      if (event.action === 'up' || event.action === 'cancel') {
        tracking = false; event.action === 'cancel' ? controller.cancel() : controller.commit(); show();
      }
    });
    listen(view, 'valueChange', event => {
      if (event.value !== view.value) return;
      controller.change(Math.min(props.max, props.min + view.value * props.step), tracking ? 'pointer' : 'accessibility');
      if (!tracking) controller.commit('accessibility'); show();
    });
    return base(view, node => {
      if (node.kind !== 'Slider') return; props = node.props; controller.update(props);
      view.minValue = 0; view.maxValue = Math.ceil((props.max - props.min) / props.step); view.isEnabled = !props.disabled; show();
    }, () => controller.dispose(), {suspend() { tracking = false; controller.cancel(); show(); }});
  }
  if (initial.kind === 'Select' || initial.kind === 'Tabs') {
    const view = initial.kind === 'Tabs' ? new FlexboxLayout() : new HYNativeButton({text:'',icon:'chevronDown'},context.theme(),false);
    const controller = new HYSelectionController(initial.key, selectionProps(initial.props), context.emit);
    let props = initial.props, picker: boolean = false, cancelPicker: (() => void) | undefined;
    const tabs = new Map<string, {view: Button; off: () => void}>();
    if (view instanceof FlexboxLayout) { view.flexDirection = 'row'; view.flexWrap = 'wrap'; view.gap = 4; }
    const render = () => write(() => {
      if (view instanceof Button) { (view as HYNativeButton).setPresentation({text:props.options.find(o => o.value === props.value)?.label??'',icon:'chevronDown',disabled:!!props.disabled},context.theme()); return; }
      const wanted = new Set(props.options.map(o => o.value));
      for (const [key, tab] of tabs) if (!wanted.has(key)) { view.removeChild(tab.view); tab.off(); tabs.delete(key); }
      props.options.forEach((option, index) => {
        let tab = tabs.get(option.value);
        if (!tab) {
          const button = new Button(), callback = () => { if (enabled()) { focus(); controller.choose(option.value, reason()); render(); } };
          button.minHeight = 44; button.paddingLeft = 12; button.paddingRight = 12;
          tab = {view: button, off: context.listen(button, 'tap', callback)}; tabs.set(option.value, tab);
        }
        if (view.getChildIndex(tab.view) !== index) { if (tab.view.parent) view.removeChild(tab.view); view.insertChild(tab.view, index); }
        tab.view.text = option.label; tab.view.isEnabled = !props.disabled && !option.disabled;
        tab.view.accessibilityLabel = option.label; tab.view.accessibilityState = option.value === props.value ? 'selected' : undefined;
        const selected=option.value===props.value,theme=context.theme(),segmented='variant' in props&&props.variant==='segmented';
        tab.view.margin=0;tab.view.paddingLeft=14;tab.view.paddingRight=14;tab.view.fontSize=theme.fontSize;tab.view.textTransform='none';
        tab.view.color=new Color(selected?theme.color.text:theme.color.muted);tab.view.backgroundColor=new Color(selected&&segmented?(theme.color.selected??theme.color.accent):'transparent');
        tab.view.borderWidth=0;tab.view.borderBottomWidth=selected&&!segmented?2:0;tab.view.borderColor=new Color(theme.color.accent);tab.view.borderRadius=segmented?theme.radius:0;
        tab.view.opacity=tab.view.isEnabled?1:.45;tab.view.accessibilityRole='button';tab.view.accessibilityIdentifier=`${initial.key}/option-${encodeURIComponent(option.value)}`;
        if(view instanceof FlexboxLayout){view.backgroundColor=new Color(segmented?theme.color.input:'transparent');view.borderRadius=theme.radius;view.padding=segmented?4:0;}
      });
    });
    const close = () => { controller.cancel(); cancelPicker?.(); };
    if (view instanceof Button) listen(view, 'tap', () => {
      if (picker || !view.isLoaded) return;
      focus();
      const choices = props.options;
      void controller.pick(() => {
        picker=true;
        const selected=hyPickNativeOption(view,{value:props.value,options:choices,theme:context.theme(),title:initial.props.a11y?.label??'Select',cancelLabel:context.selectionCancelLabel,...('presentation' in props?{presentation:props.presentation}:{})});
        cancelPicker=selected.cancel;
        return selected.result.finally(()=>{picker=false;cancelPicker=undefined;});
      }, reason()).then(() => { if (!disposed) render(); }).catch(error => context.error(error));
    });
    return base(view, node => {
      if (node.kind !== 'Select' && node.kind !== 'Tabs') return;
      if (!same(props, node.props)) close(); props = node.props; controller.update(selectionProps(props)); render();
    }, () => { close(); tabs.forEach(tab => tab.off()); tabs.clear(); controller.dispose(); }, {suspend: close});
  }
  return undefined;
}
