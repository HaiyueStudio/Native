import type { Canvas } from '@nativescript/canvas';
/** Actual UIKit drawing bounds, which may extend beyond NativeScript's safe-area measurement. */
export function nativeViewRect(view: Canvas) {
  const bounds = (view.nativeViewProtected as UIView | undefined)?.bounds;
  const origin = view.getLocationInWindow();
  const x = origin?.x ?? 0, y = origin?.y ?? 0;
  const width = bounds?.size.width ?? view.clientWidth;
  const height = bounds?.size.height ?? view.clientHeight;
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
}
