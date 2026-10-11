export interface NativeKey {key:string;ctrlKey:boolean;metaKey:boolean;altKey:boolean;shiftKey:boolean;repeat:boolean;}
export interface NativeWheel {clientX:number;clientY:number;deltaX:number;deltaY:number;deltaMode:0;}
export interface NativeKeyBinding {key:string;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean;shiftKey?:boolean;}
export interface NativeDesktopInputOptions {
 bindings:readonly NativeKeyBinding[];
 enabled():boolean;
 keyboardEnabled?():boolean;
 onKey(event:NativeKey):boolean;
 onWheel?(event:NativeWheel):void;
}
export function matchesKey(binding:NativeKeyBinding,event:NativeKey):boolean {
 return binding.key.toLowerCase()===event.key.toLowerCase()&&!!binding.ctrlKey===event.ctrlKey&&!!binding.metaKey===event.metaKey&&!!binding.altKey===event.altKey&&!!binding.shiftKey===event.shiftKey;
}
