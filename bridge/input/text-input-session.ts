import type {NativeGuiTextRequest,NativeGuiTextSession,NativeTextDriver,NativeTextRect,NativeTextSnapshot} from './text-input-types';

/** Lease/lifecycle adapter only. Engine remains the Unicode and committed edit owner. */
export class NativeTextInputSession implements NativeGuiTextSession {
  private driver:NativeTextDriver|null=null;
  private closed=false;
  private committed:string;
  private selection:readonly [number,number];
  private preedit:{baseline:string;start:number;end:number}|null=null;
  private serial=0;
  constructor(private readonly request:NativeGuiTextRequest,private readonly onClosed:()=>void=()=>{}){
    this.committed=request.value;this.selection=request.selectionUtf16;
  }
  get composing():boolean{return this.preedit!==null;}
  get disposed():boolean{return this.closed;}
  attach(driver:NativeTextDriver):void {
    if(this.closed){driver.close();return;}
    if(this.driver)throw new Error('Native text driver already attached.');
    this.driver=driver;driver.setValue(this.committed);driver.setSelection(...this.selection);
  }
  setValue(value:string):void {if(this.closed)return;this.committed=value;this.driver?.setValue(value);}
  setSelection(anchor:number,focus:number):void {if(this.closed)return;this.selection=[anchor,focus];this.driver?.setSelection(anchor,focus);}
  setCaretRect(rect:NativeTextRect):void {if(!this.closed)this.driver?.setCaretRect(rect);}

  beginComposition(anchor=this.selection[0],focus=this.selection[1]):void {
    if(this.closed||this.preedit)return;
    this.request.onSelection(anchor,focus,this.request.generation);
    if(this.closed)return;
    this.preedit={baseline:this.committed,start:Math.min(...this.selection),end:Math.max(...this.selection)};
    this.request.onComposition({generation:this.request.generation,phase:'start',text:'',selectionUtf16:[0,0]});
  }
  nativeChanged(snapshot:NativeTextSnapshot):void {
    if(this.closed)return;
    if(snapshot.marked){
      this.beginComposition();if(this.closed)return;
      const [start,end]=snapshot.marked,text=snapshot.value.slice(start,end);
      const a=Math.max(0,Math.min(text.length,snapshot.selection[0]-start)),b=Math.max(0,Math.min(text.length,snapshot.selection[1]-start));
      this.request.onComposition({generation:this.request.generation,phase:'update',text,selectionUtf16:[a,b]});
    }else if(this.preedit){
      const p=this.preedit;this.preedit=null;
      const text=this.compositionText(snapshot,p),cancel=snapshot.value===p.baseline;
      this.request.onComposition({generation:this.request.generation,phase:cancel?'cancel':'commit',text,selectionUtf16:[text.length,text.length],eventId:++this.serial});
      if(!cancel&&!this.closed)this.request.onSelection(...snapshot.selection,this.request.generation);
    }else{
      this.request.onValue(snapshot.value,snapshot.selection,this.request.generation,++this.serial);
    }
  }
  nativeSelectionChanged(snapshot:NativeTextSnapshot):void {
    if(this.closed)return;
    if(snapshot.marked||this.preedit)this.nativeChanged(snapshot);
    else this.request.onSelection(...snapshot.selection,this.request.generation);
  }
  /** Let UIKit own marked text; ordinary deletion still uses Engine graphemes. */
  shouldReplace(start:number,end:number,text:string):boolean {
    if(this.closed)return false;
    if(this.preedit)return true;
    if(text==='\n'&&!this.request.multiline){this.request.onCommand('submit');return false;}
    if(text===''&&start!==end){this.request.onEdit({startUtf16:start,endUtf16:end,text:'',generation:this.request.generation,eventId:++this.serial});return false;}
    return true;
  }
  viewportInset(inset:{top:number;right:number;bottom:number;left:number}):void {if(!this.closed)this.request.onViewportInset(inset);}
  focusLost():void {if(!this.closed)this.request.onFocusLost(this.request.generation);}
  replaceSelection(text:string):void {
    if(this.closed||this.preedit)return;
    this.request.onEdit({startUtf16:Math.min(...this.selection),endUtf16:Math.max(...this.selection),text,generation:this.request.generation,eventId:++this.serial});
  }
  suspend():void {
    if(this.closed)return;
    if(this.preedit){this.preedit=null;this.request.onComposition({phase:'cancel',text:'',selectionUtf16:[0,0],generation:this.request.generation});}
    this.request.onFocusLost(this.request.generation);
    // A host can be used without a live Engine owner; never leave its responder alive.
    this.close();
  }
  finish():ReturnType<NonNullable<NativeGuiTextSession['finish']>> {
    const p=this.preedit,driver=this.driver;if(this.closed||!p||!driver)return null;
    driver.unmarkText();
    const snapshot=driver.snapshot();if(snapshot.marked)return null;
    const text=this.compositionText(snapshot,p);
    return {phase:'commit',text,selectionUtf16:[text.length,text.length],generation:this.request.generation,eventId:++this.serial};
  }
  close():void {
    if(this.closed)return;this.closed=true;this.preedit=null;
    const driver=this.driver;this.driver=null;
    try{driver?.close();}finally{this.onClosed();}
  }
  private compositionText(snapshot:NativeTextSnapshot,p:{baseline:string;start:number;end:number}):string {
    return snapshot.value.slice(p.start,Math.max(p.start,snapshot.value.length-(p.baseline.length-p.end)));
  }
}
