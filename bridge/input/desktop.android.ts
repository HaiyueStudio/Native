import {Application,Screen,type View} from '@nativescript/core';
import {matchesKey,type NativeDesktopInputOptions,type NativeKey} from './desktop-types';
export type {NativeDesktopInputOptions,NativeKey,NativeWheel,NativeKeyBinding} from './desktop-types';
/** Explicit opt-in: owns this view's key/generic-motion listeners until disposal. */
export class NativeDesktopInput {
 private paused=false;private disposed=false;private native:android.view.View|null=null;private focusable=false;private touchFocusable=false;
 constructor(private view:View,private options:NativeDesktopInputOptions){this.attach();view.on('loaded',this.attach);view.on('unloaded',this.suspend);}
 private readonly attach=()=>{
  if(this.disposed)return;const v=this.view.nativeViewProtected as android.view.View|undefined;if(!v||v===this.native)return;this.detach();this.native=v;this.focusable=v.isFocusable();this.touchFocusable=v.isFocusableInTouchMode();
  v.setOnKeyListener(new android.view.View.OnKeyListener({onKey:(_v,code,e)=>{
   if(this.paused||!this.options.enabled()||this.options.keyboardEnabled?.()===false||e.getAction()!==android.view.KeyEvent.ACTION_DOWN)return false;
   const names:Record<number,string>={19:'ArrowUp',20:'ArrowDown',21:'ArrowLeft',22:'ArrowRight',67:'Backspace',112:'Delete',111:'Escape'};
   const unicode=e.getUnicodeChar(e.getMetaState()&~(android.view.KeyEvent.META_CTRL_MASK|android.view.KeyEvent.META_META_MASK));
   const key=names[code]??(unicode?String.fromCodePoint(unicode):'');
   const event:NativeKey={key,ctrlKey:e.isCtrlPressed(),metaKey:e.isMetaPressed(),altKey:e.isAltPressed(),shiftKey:e.isShiftPressed(),repeat:e.getRepeatCount()>0};
   return this.options.bindings.some(b=>matchesKey(b,event))&&this.options.onKey(event);
  }}));
  v.setOnGenericMotionListener(new android.view.View.OnGenericMotionListener({onGenericMotion:(_v,e)=>{
   if(this.paused||!this.options.enabled()||!this.options.onWheel||e.getAction()!==android.view.MotionEvent.ACTION_SCROLL)return false;
   const origin=this.view.getLocationInWindow(),scale=Screen.mainScreen.scale;
   this.options.onWheel({clientX:(origin?.x??0)+e.getX()/scale,clientY:(origin?.y??0)+e.getY()/scale,deltaX:-e.getAxisValue(android.view.MotionEvent.AXIS_HSCROLL)*40,deltaY:-e.getAxisValue(android.view.MotionEvent.AXIS_VSCROLL)*40,deltaMode:0});return true;
  }}));
 };
 focus(){if(this.disposed||this.paused||!this.options.enabled()||this.native?.hasFocus())return;const focused=Application.android.foregroundActivity?.getCurrentFocus();if(focused instanceof android.widget.EditText)return;this.native?.setFocusableInTouchMode(true);this.native?.requestFocus();}
 readonly suspend=()=>{this.paused=true;};resume(){this.paused=false;}
 private detach(){this.native?.setOnKeyListener(null!);this.native?.setOnGenericMotionListener(null!);this.native?.setFocusableInTouchMode(this.touchFocusable);this.native?.setFocusable(this.focusable);this.native=null;}
 dispose(){if(this.disposed)return;this.disposed=true;this.paused=true;this.view.off('loaded',this.attach);this.view.off('unloaded',this.suspend);this.detach();}
}
