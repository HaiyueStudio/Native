import type {GuiSystemOptions} from '@haiyue/engine/gui';

/** Consume the public Engine option structurally; no Engine private source imports. */
export type NativeGuiTextHost=Exclude<NonNullable<GuiSystemOptions['textInputHost']>,'browser'>;
export type NativeGuiTextRequest=Parameters<NativeGuiTextHost['open']>[0];
export type NativeGuiTextSession=ReturnType<NativeGuiTextHost['open']>;
export type NativeTextRect=Parameters<NativeGuiTextSession['setCaretRect']>[0];
export interface NativeTextSnapshot {
  readonly value:string;
  readonly selection:readonly [number,number];
  readonly marked:readonly [number,number]|null;
}
export interface NativeTextDriver {
  setValue(value:string):void;
  setSelection(anchor:number,focus:number):void;
  setCaretRect(rect:NativeTextRect):void;
  snapshot():NativeTextSnapshot;
  unmarkText():void;
  close():void;
}
