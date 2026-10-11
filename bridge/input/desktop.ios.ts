import type {View} from '@nativescript/core';
import type {NativeDesktopInputOptions,NativeKeyBinding} from './desktop-types';
export type {NativeDesktopInputOptions,NativeKey,NativeWheel,NativeKeyBinding} from './desktop-types';
const special=()=>({ArrowUp:UIKeyInputUpArrow,ArrowDown:UIKeyInputDownArrow,ArrowLeft:UIKeyInputLeftArrow,ArrowRight:UIKeyInputRightArrow,Escape:UIKeyInputEscape,Backspace:'\b',Delete:'\u007f'});
function flags(b:NativeKeyBinding){return (b.metaKey?UIKeyModifierFlags.Command:0)|(b.ctrlKey?UIKeyModifierFlags.Control:0)|(b.altKey?UIKeyModifierFlags.Alternate:0)|(b.shiftKey?UIKeyModifierFlags.Shift:0);}
@NativeClass()
class KeyboardView extends UIView {
 static ObjCExposedMethods={onCommand:{returns:interop.types.void,params:[UIKeyCommand]}};
 owner:NativeDesktopInput|null=null;
 // @ts-expect-error NativeScript overrides Objective-C readonly properties with JS getters.
 get canBecomeFirstResponder(){return true;}
 // @ts-expect-error NativeScript overrides Objective-C readonly properties with JS getters.
 get keyCommands():NSArray<UIKeyCommand>{return this.owner?.keyboardEnabled?this.owner.commands:NSArray.arrayWithArray([]);}
 onCommand(command:UIKeyCommand){this.owner?.command(command);}
}
@NativeClass()
class WheelHandler extends NSObject {
 static ObjCExposedMethods={scroll:{returns:interop.types.void,params:[UIPanGestureRecognizer]}};
 owner:NativeDesktopInput|null=null;
 scroll(recognizer:UIPanGestureRecognizer){this.owner?.scroll(recognizer);}
}
function hasOtherResponder(root:UIView,self:UIView):boolean{
 if(root!==self&&root.isFirstResponder)return true;
 for(let i=0;i<root.subviews.count;i++)if(hasOtherResponder(root.subviews.objectAtIndex(i),self))return true;
 return false;
}
/** Opt-in physical keyboard and wheel bridge. A mouse click remains UIKit's normal touch, avoiding duplicate clicks. */
export class NativeDesktopInput {
 readonly commands:NSArray<UIKeyCommand>;
 private responder=KeyboardView.new() as KeyboardView;
 private handler=WheelHandler.new() as WheelHandler;
 private wheel:UIPanGestureRecognizer;
 private paused=false;private disposed=false;
 constructor(private view:View,private options:NativeDesktopInputOptions){
  const keys=special();
  this.commands=NSArray.arrayWithArray(options.bindings.map(b=>UIKeyCommand.keyCommandWithInputModifierFlagsAction(keys[b.key as keyof typeof keys]??b.key,flags(b),'onCommand')));
  this.responder.owner=this;this.responder.frame=CGRectMake(0,0,0,0);
  this.handler.owner=this;
  this.wheel=UIPanGestureRecognizer.alloc().initWithTargetAction(this.handler,'scroll');
  this.wheel.allowedScrollTypesMask=UIScrollTypeMask.All;
  this.wheel.allowedTouchTypes=NSArray.arrayWithArray([]); // wheel/trackpad only; do not intercept touch drags
  this.wheel.cancelsTouchesInView=false;
  this.attach();view.on('loaded',this.attach);view.on('unloaded',this.suspend);
 }
 get keyboardEnabled(){return !this.disposed&&!this.paused&&this.options.enabled()&&(this.options.keyboardEnabled?.()??true);}
 private readonly attach=()=>{if(this.disposed)return;const v=this.view.nativeViewProtected as UIView|undefined;if(!v)return;if(this.responder.superview!==v)v.addSubview(this.responder);if(this.wheel.view!==v)v.addGestureRecognizer(this.wheel);};
 focus(){const v=this.responder;if(this.disposed||this.paused||!this.options.enabled()||v.isFirstResponder||!v.window||hasOtherResponder(v.window,v))return;v.becomeFirstResponder();}
 command(command:UIKeyCommand){if(!this.keyboardEnabled)return;const index=this.commands.indexOfObject(command);const b=this.options.bindings[index];if(b)this.options.onKey({key:b.key,ctrlKey:!!b.ctrlKey,metaKey:!!b.metaKey,altKey:!!b.altKey,shiftKey:!!b.shiftKey,repeat:false});}
 scroll(recognizer:UIPanGestureRecognizer){const v=this.view.nativeViewProtected as UIView,d=recognizer.translationInView(v);recognizer.setTranslationInView(CGPointMake(0,0),v);if(this.paused||this.disposed||!this.options.enabled())return;const p=recognizer.locationInView(v.window);this.options.onWheel?.({clientX:p.x,clientY:p.y,deltaX:-d.x,deltaY:-d.y,deltaMode:0});}
 readonly suspend=()=>{this.paused=true;this.responder.resignFirstResponder();};
 resume(){if(this.disposed)return;this.paused=false;this.focus();}
 dispose(){if(this.disposed)return;this.suspend();this.disposed=true;this.view.off('loaded',this.attach);this.view.off('unloaded',this.suspend);this.wheel.view?.removeGestureRecognizer(this.wheel);this.responder.removeFromSuperview();this.responder.owner=null;this.handler.owner=null;}
}
