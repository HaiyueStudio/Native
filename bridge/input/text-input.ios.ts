import {NativeTextInputSession} from './text-input-session';
import type {NativeGuiTextHost,NativeGuiTextRequest,NativeGuiTextSession,NativeTextDriver,NativeTextRect,NativeTextSnapshot} from './text-input-types';

@NativeClass()
class GuiTextResponder extends UITextView {
  owner:IosTextDriver|null=null;
  override setMarkedTextSelectedRange(text:string,range:NSRange):void {
    // Capture the committed selection before UIKit replaces it with marked text.
    this.owner?.beginComposition();super.setMarkedTextSelectedRange(text,range);this.owner?.changed();
  }
  override unmarkText():void {super.unmarkText();this.owner?.changed();}
  override caretRectForPosition(position:UITextPosition):CGRect {return this.owner?.candidateRect()??super.caretRectForPosition(position);}
  override firstRectForRange(range:UITextRange):CGRect {return this.owner?.candidateRect()??super.firstRectForRange(range);}
  override layoutSubviews():void {super.layoutSubviews();this.owner?.geometryChanged();}
  override safeAreaInsetsDidChange():void {super.safeAreaInsetsDidChange();this.owner?.geometryChanged();}
  override didMoveToWindow():void {super.didMoveToWindow();if(!this.window)this.owner?.detached();}
}

@NativeClass()
class GuiTextDelegate extends NSObject implements UITextViewDelegate {
  static ObjCProtocols=[UITextViewDelegate];
  owner:IosTextDriver|null=null;
  textViewDidChange():void {this.owner?.changed();}
  textViewDidChangeSelection():void {this.owner?.selectionChanged();}
  textViewDidEndEditing():void {this.owner?.focusLost();}
  textViewShouldChangeTextInRangeReplacementText(_view:UITextView,range:NSRange,text:string):boolean {
    return this.owner?.shouldReplace(range.location,range.location+range.length,text)??false;
  }
}

/** Native UIKit responder only; committed text and Unicode editing remain in Engine. */
class IosTextDriver implements NativeTextDriver {
  readonly view=GuiTextResponder.new() as GuiTextResponder;
  private readonly delegate=GuiTextDelegate.new() as GuiTextDelegate;
  private synchronizing=0;
  private closed=false;
  private caret:NativeTextRect|null=null;
  private selection:readonly [number,number]=[0,0];
  constructor(private readonly parent:UIView,private readonly lease:NativeTextInputSession,request:NativeGuiTextRequest,private readonly onGeometry:()=>void){
    const view=this.view;view.owner=this;this.delegate.owner=this;view.delegate=this.delegate;
    view.frame=parent.bounds;view.autoresizingMask=UIViewAutoresizing.FlexibleWidth|UIViewAutoresizing.FlexibleHeight;
    view.backgroundColor=UIColor.clearColor;view.textColor=UIColor.clearColor;view.tintColor=UIColor.clearColor;
    view.font=UIFont.systemFontOfSize(16);view.scrollEnabled=false;view.userInteractionEnabled=false;
    view.textContainerInset={top:0,right:0,bottom:0,left:0};view.textContainer.lineFragmentPadding=0;
    view.autocorrectionType=UITextAutocorrectionType.No;view.spellCheckingType=UITextSpellCheckingType.No;
    view.autocapitalizationType=UITextAutocapitalizationType.None;
    view.smartDashesType=UITextSmartDashesType.No;view.smartQuotesType=UITextSmartQuotesType.No;
    view.smartInsertDeleteType=UITextSmartInsertDeleteType.No;
    view.secureTextEntry=request.inputType==='password';
    view.keyboardType=request.inputType==='email'?UIKeyboardType.EmailAddress:request.inputType==='number'?UIKeyboardType.DecimalPad:UIKeyboardType.Default;
    view.returnKeyType=request.multiline?UIReturnKeyType.Default:UIReturnKeyType.Done;
    parent.addSubview(view);
  }
  activate():void {
    if(this.closed||!this.view.window||!this.view.becomeFirstResponder())throw new Error('GUI text input requires an attached, active UIKit view.');
    this.onGeometry();
  }
  setValue(value:string):void {if(!this.closed&&this.view.text!==value)this.sync(()=>{this.view.text=value;});}
  setSelection(anchor:number,focus:number):void {
    if(this.closed)return;this.selection=[anchor,focus];
    const start=Math.min(anchor,focus),end=Math.max(anchor,focus),range=this.view.selectedRange;
    if(range.location!==start||range.length!==end-start)this.sync(()=>{this.view.selectedRange={location:start,length:end-start};});
  }
  setCaretRect(rect:NativeTextRect):void {
    if(this.closed)return;
    this.sync(()=>{this.view.inputDelegate?.selectionWillChange(this.view);this.caret={...rect};this.view.inputDelegate?.selectionDidChange(this.view);});
  }
  snapshot():NativeTextSnapshot {
    const view=this.view,range=view.selectedRange,start=range.location,end=start+range.length;
    const selection:readonly [number,number]=Math.min(...this.selection)===start&&Math.max(...this.selection)===end?this.selection:[start,end];
    const marked=view.markedTextRange;
    const markedStart=marked?view.offsetFromPositionToPosition(view.beginningOfDocument,marked.start):0;
    return {value:view.text??'',selection,marked:marked?[markedStart,markedStart+view.offsetFromPositionToPosition(marked.start,marked.end)]:null};
  }
  unmarkText():void {if(!this.closed)this.view.unmarkText();}
  beginComposition():void {if(this.live()){const snapshot=this.snapshot();this.lease.beginComposition(...snapshot.selection);}}
  changed():void {if(this.live())this.lease.nativeChanged(this.snapshot());}
  selectionChanged():void {if(this.live())this.lease.nativeSelectionChanged(this.snapshot());}
  shouldReplace(start:number,end:number,text:string):boolean {return this.live()&&this.lease.shouldReplace(start,end,text);}
  focusLost():void {if(this.live())this.lease.focusLost();}
  detached():void {if(this.live())this.lease.suspend();}
  geometryChanged():void {if(this.live())this.onGeometry();}
  candidateRect():CGRect|null {
    const caret=this.caret,window=this.view.window;if(!caret||!window||this.closed)return null;
    const rect=window.convertRectFromCoordinateSpace(CGRectMake(caret.x,caret.y,caret.width,caret.height),window.screen.coordinateSpace);
    return this.view.convertRectFromView(rect,window);
  }
  close():void {
    if(this.closed)return;this.closed=true;
    this.view.owner=null;this.delegate.owner=null;
    // Detach callback owners before resigning: UIKit can synchronously unmark/end editing.
    this.view.resignFirstResponder();this.view.removeFromSuperview();this.caret=null;
  }
  private live():boolean{return !this.closed&&this.synchronizing===0&&!this.lease.disposed;}
  private sync(operation:()=>void):void {this.synchronizing++;try{operation();}finally{this.synchronizing--;}}
}

/** One host per native GUI surface. Dispose with that surface; suspension cancels pending preedit. */
export class NativeGuiTextInputHost implements NativeGuiTextHost {
  private active:NativeTextInputSession|null=null;
  private driver:IosTextDriver|null=null;
  private generation:number|null=null;
  private readonly observers:NSObjectProtocol[]=[];
  private keyboard:CGRect|null=null;
  private disposed=false;
  private suspended=false;
  private insetKey='';
  private password=false;
  private inputType:NativeGuiTextRequest['inputType']='text';
  constructor(private readonly view:UIView,private readonly report:(event:string,detail:unknown)=>void=()=>{}){
    const center=NSNotificationCenter.defaultCenter;
    const observe=(name:string,callback:(notification:NSNotification)=>void)=>this.observers.push(center.addObserverForNameObjectQueueUsingBlock(name,null,NSOperationQueue.mainQueue,callback));
    const keyboard=(notification:NSNotification)=>{
      this.keyboard=(notification.userInfo?.objectForKey(UIKeyboardFrameEndUserInfoKey) as NSValue|undefined)?.CGRectValue??null;this.geometryChanged();
    };
    observe(UIKeyboardWillChangeFrameNotification,keyboard);observe(UIKeyboardDidChangeFrameNotification,keyboard);
    observe(UIKeyboardWillHideNotification,()=>{this.keyboard=null;this.geometryChanged();});
    observe(UIApplicationWillResignActiveNotification,()=>this.suspend());
    observe(UIApplicationDidBecomeActiveNotification,()=>this.resume());
  }
  open(request:NativeGuiTextRequest):NativeGuiTextSession {
    if(this.disposed||this.suspended)throw new Error('Native GUI text host is not active.');
    this.active?.close();
    this.insetKey='';
    this.password=request.inputType==='password';
    this.inputType=request.inputType;
    const safeText=(text:string)=>request.inputType==='password'?{utf16Length:text.length,redacted:true}:text;
    const monitored:NativeGuiTextRequest={...request,
      onComposition:event=>{request.onComposition(event);this.report('text-composition',{...event,text:safeText(event.text)});},
      onValue:(value,selection,generation,eventId)=>{request.onValue(value,selection,generation,eventId);this.report('text-native-value',{value:safeText(value),selection,generation,eventId});},
      onSelection:(...args)=>{request.onSelection(...args);this.report('text-selection',{selection:[args[0],args[1]],generation:args[2]});},
      onViewportInset:inset=>{request.onViewportInset(inset);this.report('text-inset',{inset,generation:request.generation});},
    };
    const lease=new NativeTextInputSession(monitored,()=>{if(this.active===lease){this.active=null;this.driver=null;this.generation=null;}this.report('text-session-closed',{...this.snapshot(),closedGeneration:request.generation});});
    this.generation=request.generation;
    this.active=lease;let driver:IosTextDriver|undefined;
    try{driver=new IosTextDriver(this.view,lease,monitored,this.geometryChanged);this.driver=driver;lease.attach(driver);driver.activate();this.report('text-session-opened',this.snapshot());}
    catch(error){lease.close();driver?.close();throw error;}
    return lease;
  }
  readonly geometryChanged=():void=>{
    const window=this.view.window;if(!window||!this.active)return;
    const safe=this.view.safeAreaInsets,bounds=this.view.bounds;
    let bottom=Math.max(0,safe.bottom);
    if(this.keyboard){
      const rect=window.convertRectFromCoordinateSpace(this.keyboard,window.screen.coordinateSpace),local=this.view.convertRectFromView(rect,window);
      const intersects=local.origin.x<bounds.origin.x+bounds.size.width&&local.origin.x+local.size.width>bounds.origin.x&&local.origin.y<bounds.origin.y+bounds.size.height&&local.origin.y+local.size.height>bounds.origin.y;
      if(intersects)bottom=Math.max(bottom,Math.min(bounds.size.height,bounds.origin.y+bounds.size.height-local.origin.y));
    }
    const inset={top:Math.max(0,safe.top),right:Math.max(0,safe.right),bottom,left:Math.max(0,safe.left)},key=JSON.stringify(inset);
    if(key!==this.insetKey){this.insetKey=key;this.active.viewportInset(inset);}
  };
  suspend():void {if(this.disposed)return;this.suspended=true;this.keyboard=null;this.active?.suspend();}
  copySelection(cut=false):void {
    if(!this.active||!this.driver||this.password||this.active.composing)return;
    const snapshot=this.driver.snapshot(),start=Math.min(...snapshot.selection),end=Math.max(...snapshot.selection);
    if(start===end)return;UIPasteboard.generalPasteboard.string=snapshot.value.slice(start,end);
    if(cut)this.active.replaceSelection('');
  }
  paste():void {const text=UIPasteboard.generalPasteboard.string;if(text)this.active?.replaceSelection(text);}
  resume():void {if(this.disposed)return;this.suspended=false;this.geometryChanged();}
  dispose():void {
    if(this.disposed)return;this.suspend();this.disposed=true;
    for(const observer of this.observers)NSNotificationCenter.defaultCenter.removeObserver(observer);this.observers.length=0;
    this.report('text-host-disposed',this.snapshot());
  }
  snapshot(){return {generation:this.generation,inputType:this.active?this.inputType:null,keyboardType:this.driver?.view.keyboardType??null,secureTextEntry:this.driver?.view.secureTextEntry??false,responderCount:this.driver&&!this.active?.disposed?1:0,firstResponder:this.driver?.view.isFirstResponder??false,attached:!!this.driver?.view.window,observerCount:this.observers.length,suspended:this.suspended,disposed:this.disposed};}
}
