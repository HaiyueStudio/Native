import {createModalSurface} from './modal';
import { same } from './data';
import { Button, Color, FlexboxLayout, GridLayout, Label, ScrollView, Slider, StackLayout, Switch, TextField, TextView, View } from '@nativescript/core';
import { HYButtonController, HYSelectionController, HYSliderController, HYTextController, HYToggleController } from '@haiyue/ui/core';
import type { HYNode, HYReason, HYUIEvent, HYTheme } from '@haiyue/ui/core';
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
  if (initial.kind === 'Button') {
    const view = new Button(), controller = new HYButtonController(initial.key, initial.props, context.emit);
    listen(view, 'tap', () => { focus(); controller.activate(reason()); });
    return base(view, node => { if (node.kind !== 'Button') return; controller.update(node.props); view.text = node.props.busy ? `${node.props.text}…` : node.props.text; view.isEnabled = !node.props.disabled && !node.props.busy; }, () => controller.dispose());
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
    const view = initial.kind === 'Tabs' ? new FlexboxLayout() : new Button();
    const controller = new HYSelectionController(initial.key, initial.props, context.emit);
    let props = initial.props, picker: StackLayout | undefined, cancelPicker: (() => void) | undefined;
    const tabs = new Map<string, {view: Button; off: () => void}>();
    if (view instanceof FlexboxLayout) { view.flexDirection = 'row'; view.flexWrap = 'wrap'; view.gap = 4; }
    const render = () => write(() => {
      if (view instanceof Button) { view.text = props.options.find(o => o.value === props.value)?.label ?? ''; view.isEnabled = !props.disabled; return; }
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
        tab.view.opacity = option.value === props.value ? 1 : 0.65;
      });
    });
    const close = () => { controller.cancel(); cancelPicker?.(); };
    if (view instanceof Button) listen(view, 'tap', () => {
      if (picker || !view.isLoaded) return;
      focus();
      const choices = props.options;
      void controller.pick(() => new Promise<string | null>(resolve => {
        const panel = new StackLayout(); picker = panel; panel.padding = 20; const theme = context.theme(); panel.backgroundColor = new Color(theme.color.surface); panel.accessibilityLabel = initial.props.a11y?.label ?? 'Select';
        const surfaceCleanup:(()=>void)[]=[];
        const modal=createModalSurface(panel,(target,name,callback)=>{const off=context.listen(target,name,callback);surfaceCleanup.push(off);return off;},()=>finish(null));
        modal.card.backgroundColor=new Color(theme.color.surface);modal.card.borderColor=new Color(theme.color.border);modal.card.borderWidth=1;modal.card.borderRadius=theme.radius;
        let settled = false, closing = false, selected: string | null = null;
        const cleanup: (() => void)[] = [];
        const settle = () => {
          if (settled) return; settled = true;
          cleanup.forEach(off => off());surfaceCleanup.forEach(off=>off()); picker = undefined; cancelPicker = undefined;
          resolve(selected);
        };
        const finish = (value: string | null) => {
          if (closing || settled) return;
          closing = true; selected = value; cleanup.forEach(off => off());
          // Do not release the busy state until native dismissal completes. UIKit still owns the sheet.
          modal.page.closeModal();
        };
        cancelPicker = () => finish(null);
        for (const option of [...choices, {value: null, label: context.selectionCancelLabel ?? 'Cancel', disabled: false}]) {
          const button = new Button(); button.text = option.label; button.isEnabled = !option.disabled;
          button.minHeight = 44; button.margin = 4; button.padding = 12; button.fontSize = theme.fontSize;
          button.backgroundColor = new Color(option.value === props.value ? theme.color.accent : theme.color.input);
          button.color = new Color(theme.color.text); button.borderColor = new Color(theme.color.border); button.borderWidth = 1; button.borderRadius = theme.radius;
          const tap = () => finish(option.value); cleanup.push(context.listen(button, 'tap', tap)); panel.addChild(button);
        }
        try { view.showModal(modal.page, {...modalPresentationOptions(),fullscreen: true, animated: false, closeCallback: settle}); }
        catch (error) { settle(); throw error; }
      }), reason()).then(() => { if (!disposed) render(); }).catch(error => context.error(error));
    });
    return base(view, node => {
      if (node.kind !== 'Select' && node.kind !== 'Tabs') return;
      if (!same(props, node.props)) close(); props = node.props; controller.update(props); render();
    }, () => { close(); tabs.forEach(tab => tab.off()); tabs.clear(); controller.dispose(); }, {suspend: close});
  }
  return undefined;
}
