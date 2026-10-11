import {Screen,type View} from '@nativescript/core';
export function windowMetrics(view:View) {
 const scale=Screen.mainScreen.scale,native=view.nativeViewProtected as android.view.View|undefined,i=native?.getRootWindowInsets?.();
 // Coordinates are those of the supplied content view; its layout may already exclude system insets.
 return {...view.getActualSize(),scale,safeArea:{top:(i?.getSystemWindowInsetTop()??0)/scale,right:(i?.getSystemWindowInsetRight()??0)/scale,bottom:(i?.getSystemWindowInsetBottom()??0)/scale,left:(i?.getSystemWindowInsetLeft()??0)/scale}};
}
