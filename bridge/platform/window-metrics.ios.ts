import {Screen,type View} from '@nativescript/core';
export function windowMetrics(view:View) {
  const size=view.getActualSize();
  const native=view.nativeViewProtected as UIView|undefined,b=native?.bounds,i=native?.safeAreaInsets;
  return {width:size.width||b?.size.width||0,height:size.height||b?.size.height||0,
    scale:native?.window?.screen.scale??Screen.mainScreen.scale,
    safeArea:{top:i?.top??0,right:i?.right??0,bottom:i?.bottom??0,left:i?.left??0}};
}
