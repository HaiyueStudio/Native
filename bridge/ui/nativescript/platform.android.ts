import { HY_ICONS } from '@haiyue/ui/portable';
import type { HYIconName } from '@haiyue/ui/core';
import { Application, Color, Utils, type View, type ImageSource } from '@nativescript/core';
import type { HYNativeTextHandle, HYTextObservation } from './types';

export function assertMainThread(): void {
  if (!android.os.Looper.getMainLooper().equals(android.os.Looper.myLooper())) throw new Error('Native UI commits must run on the main thread');
}
export function isAccessibilityInteraction(): boolean {
  const manager = Application.android.context.getSystemService(android.content.Context.ACCESSIBILITY_SERVICE) as android.view.accessibility.AccessibilityManager;
  return !!manager?.isTouchExplorationEnabled();
}
export function focusNative(view: View): void {
  view.focus();
  if (isAccessibilityInteraction()) view.android?.performAccessibilityAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null);
}
export function systemIcon(_name: string): ImageSource | undefined { return undefined; }
export function setClipping(view: View, clip: boolean): void {
  const native = view.android as android.view.View;
  // Android's API accepts null to clear clipping; generated typings omit nullability.
  if (native) native.setClipBounds(clip ? new android.graphics.Rect(0, 0, native.getWidth(), native.getHeight()) : null!);
}
export function observeText(view: View, changed: (state: HYTextObservation) => void, _dismissLabel?: string): HYNativeTextHandle {
  const input = view.android as android.widget.EditText;
  let disposed = false, writing = false, attached: android.text.Editable | undefined;
  const read = (): HYTextObservation => {
    const value = input.getText();
    return {value: value.toString(), composing: android.view.inputmethod.BaseInputConnection.getComposingSpanStart(value) >= 0};
  };
  // SpanWatcher catches finishComposingText(), which may remove IME spans without changing any text.
  // Post coalesces TextWatcher + span notifications into one observation after the IME operation.
  let pending = false;
  const runnable = new java.lang.Runnable({run() { pending = false; if (!disposed && !writing) changed(read()); }});
  const queue = () => { if (!disposed && !writing && !pending) { pending = true; input.post(runnable); } };
  const spans = new android.text.SpanWatcher({onSpanAdded: queue, onSpanRemoved: queue, onSpanChanged: queue});
  const attach = () => {
    const editable = input.getText();
    if (attached === editable) return;
    attached?.removeSpan(spans); attached = editable;
    editable.setSpan(spans, 0, editable.length(), android.text.Spanned.SPAN_INCLUSIVE_INCLUSIVE);
  };
  const watcher = new android.text.TextWatcher({beforeTextChanged() {}, onTextChanged() {}, afterTextChanged() { attach(); queue(); }});
  input.addTextChangedListener(watcher); attach();
  return {read, write(value) {
    if (disposed || value === read().value) return;
    const start = Math.max(0, input.getSelectionStart()), end = Math.max(0, input.getSelectionEnd());
    writing = true;
    try { (view as View & {text: string}).text = value; input.setSelection(Math.min(start, value.length), Math.min(end, value.length)); attach(); }
    finally { writing = false; }
  }, dispose() {
    if (disposed) return;
    disposed = true; input.removeCallbacks(runnable); pending = false;
    input.removeTextChangedListener(watcher); attached?.removeSpan(spans); attached = undefined;
  }};
}
export function observeKeyboard(view: View, changed: (height: number) => void): () => void {
  const native = view.android as android.view.View;
  const tree = native.getViewTreeObserver();
  let disposed = false;
  const listener = new android.view.ViewTreeObserver.OnGlobalLayoutListener({onGlobalLayout() {
    // Android may already be dispatching a snapshot of listeners when we unload.
    if (disposed) return;
    if (android.os.Build.VERSION.SDK_INT >= 30) {
      const insets = native.getRootWindowInsets();
      changed(insets?.isVisible(android.view.WindowInsets.Type.ime()) ? Utils.layout.toDeviceIndependentPixels(insets.getInsets(android.view.WindowInsets.Type.ime()).bottom) : 0);
    } else {
      const frame = new android.graphics.Rect(); native.getWindowVisibleDisplayFrame(frame);
      const diff = native.getRootView().getHeight() - frame.bottom;
      changed(diff > native.getRootView().getHeight() / 5 ? Utils.layout.toDeviceIndependentPixels(diff) : 0);
    }
  }});
  tree.addOnGlobalLayoutListener(listener);
  return () => {
    if (disposed) return;
    disposed = true;
    // An unattached view's observer is merged into the window's observer on
    // attach. The old observer then dies, but the listener remains registered.
    const current = tree.isAlive() ? tree : native.getViewTreeObserver();
    if (current.isAlive()) current.removeOnGlobalLayoutListener(listener);
  };
}

/** Keep the presenting page visible beneath the portable dialog backdrop. */
export function modalPresentationOptions(): Partial<import('@nativescript/core').ShowModalOptions> { return {}; }

/** Native drawables share the Web vector paths and keep the OS Button hit target. */
export function buttonAdornment(view: View, icon: HYIconName | undefined, busy: boolean, color: string): () => void {
  const button = view.android as android.widget.Button;
  if (!button) return () => {};
  const size = Math.round(Utils.layout.toDevicePixels(20));
  let drawable: android.graphics.drawable.Drawable | undefined;
  let spinner: android.graphics.drawable.Animatable | undefined;
  if (busy) {
    drawable = new android.widget.ProgressBar(button.getContext()).getIndeterminateDrawable().mutate();
    drawable.setTint(new Color(color).android);spinner = drawable as unknown as android.graphics.drawable.Animatable;
  } else if (icon) {
    const bitmap = android.graphics.Bitmap.createBitmap(size,size,android.graphics.Bitmap.Config.ARGB_8888);
    const canvas = new android.graphics.Canvas(bitmap), paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
    paint.setColor(new Color(color).android);paint.setStyle(android.graphics.Paint.Style.STROKE);paint.setStrokeWidth(size*1.8/24);paint.setStrokeCap(android.graphics.Paint.Cap.ROUND);paint.setStrokeJoin(android.graphics.Paint.Join.ROUND);
    for (const points of HY_ICONS[icon]) {
      const path = new android.graphics.Path();
      points.forEach(([x,y],index) => index ? path.lineTo(x*size/24,y*size/24) : path.moveTo(x*size/24,y*size/24));canvas.drawPath(path,paint);
    }
    drawable = new android.graphics.drawable.BitmapDrawable(button.getResources(),bitmap);
  }
  drawable?.setBounds(0,0,size,size);
  // Foreground is centered for icon-only controls; labeled controls use a start drawable.
  if (!(view as View & {text:string}).text) { button.setForeground(drawable ?? null!);button.setForegroundGravity(android.view.Gravity.CENTER); }
  else if(icon==='chevronDown')button.setCompoundDrawables(null!,null!,drawable ?? null!,null!);
  else button.setCompoundDrawables(drawable ?? null!,null!,null!,null!);
  drawable?.setCallback(button);spinner?.start();
  return () => { spinner?.stop();button.setForeground(null!);button.setCompoundDrawables(null!,null!,null!,null!);drawable?.setCallback(null!); };
}
