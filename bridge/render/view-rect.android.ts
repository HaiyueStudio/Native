import { Screen } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
/** Drawing and touch bounds share Android density-independent pixels. */
export function nativeViewSize(view: Canvas) {
  const native = view.nativeViewProtected as android.view.View | undefined;
  const scale = Screen.mainScreen.scale;
  return { width: native ? native.getWidth() / scale : view.clientWidth,
    height: native ? native.getHeight() / scale : view.clientHeight };
}
export function nativeViewRect(view: Canvas) {
  const origin = view.getLocationInWindow();
  const x = origin?.x ?? 0, y = origin?.y ?? 0;
  const { width, height } = nativeViewSize(view);
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
}
