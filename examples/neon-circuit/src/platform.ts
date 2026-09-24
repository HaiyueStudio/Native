import { isAndroid, Screen } from '@nativescript/core';
import type { Canvas } from '@nativescript/canvas';
import type { MotionScreenRotation } from '../../../bridge/motion/motion-sample';
import { landscapeMotionRotation } from './steering';
export function neonScreenRotation(canvas: Canvas): MotionScreenRotation {
  if (isAndroid) return (((canvas.nativeViewProtected as android.view.View).getDisplay()?.getRotation() ?? 0) * 90) as MotionScreenRotation;
  const orientation = ((canvas.nativeViewProtected as UIView).window?.windowScene as UIWindowScene | undefined)?.interfaceOrientation;
  return orientation === UIInterfaceOrientation.LandscapeLeft ? landscapeMotionRotation('left') : orientation === UIInterfaceOrientation.LandscapeRight ? landscapeMotionRotation('right') : 0;
}
export function neonSafeInsets(canvas: Canvas) {
  if (!isAndroid) {
    const i = (canvas.nativeViewProtected as UIView).safeAreaInsets;
    return { top: i.top, right: i.right, bottom: i.bottom, left: i.left };
  }
  const insets = (canvas.nativeViewProtected as android.view.View).getRootWindowInsets();
  const cutout = android.os.Build.VERSION.SDK_INT >= 28 ? insets?.getDisplayCutout() : null;
  const scale = Screen.mainScreen.scale;
  return {
    top: Math.max(insets?.getSystemWindowInsetTop() ?? 0, cutout?.getSafeInsetTop() ?? 0) / scale,
    right: Math.max(insets?.getSystemWindowInsetRight() ?? 0, cutout?.getSafeInsetRight() ?? 0) / scale,
    bottom: Math.max(insets?.getSystemWindowInsetBottom() ?? 0, cutout?.getSafeInsetBottom() ?? 0) / scale,
    left: Math.max(insets?.getSystemWindowInsetLeft() ?? 0, cutout?.getSafeInsetLeft() ?? 0) / scale,
  };
}
