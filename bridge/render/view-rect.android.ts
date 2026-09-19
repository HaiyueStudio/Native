import { Screen } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
/** Drawing and touch bounds share Android density-independent pixels. */
export function nativeViewRect(view: Canvas) {
  const native = view.nativeViewProtected as android.view.View | undefined;
  const origin = view.getLocationInWindow();
  const x = origin?.x ?? 0, y = origin?.y ?? 0;
  const width = native ? native.getWidth() / Screen.mainScreen.scale : view.clientWidth;
  const height = native ? native.getHeight() / Screen.mainScreen.scale : view.clientHeight;
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
}
