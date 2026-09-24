import type { Canvas } from '@nativescript/canvas';
/** Actual UIKit drawing bounds, which may extend beyond NativeScript's safe-area measurement. */
export function nativeViewSize(view: Canvas) {
  const bounds = (view.nativeViewProtected as UIView | undefined)?.bounds;
  return { width: bounds?.size.width ?? view.clientWidth, height: bounds?.size.height ?? view.clientHeight };
}
export function nativeViewRect(view: Canvas) {
  const origin = view.getLocationInWindow();
  const x = origin?.x ?? 0, y = origin?.y ?? 0;
  const { width, height } = nativeViewSize(view);
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
}
