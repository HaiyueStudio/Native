import type {HyaSemanticHost,HyaSemanticSnapshot} from '@haiyue/extensions/hya-data';

type Node=HyaSemanticSnapshot['nodes'][number];
type Action=Node['actions'][number];
type Listener=Parameters<HyaSemanticHost['subscribeActions']>[0];
const owners=new WeakMap<UIView,IosHyaSemantics>();
const roles=new Set(['none','group','text','button','link','image','heading','checkbox','radio','switch','slider','progress','textbox','list','list-item','menu','menu-item','dialog']);

@NativeClass()
class HyaSceneAccessibilityElement extends UIAccessibilityElement {
  owner:IosHyaSemantics|null=null;
  nodeId='';
  override accessibilityActivate():boolean {return this.owner?.activate(this)??false;}
  override accessibilityIncrement():void {this.owner?.perform(this,'increase');}
  override accessibilityDecrement():void {this.owner?.perform(this,'decrease');}
}
interface Entry {readonly element:HyaSceneAccessibilityElement;node:Node;key:string;}
interface Options {
  record(event:string,detail:unknown):void;
  requestFrame():void;
  /** Called synchronously by the actual UIKit accessibility action, allowing an immediate audio unlock. */
  beforeAction?(node:string,action:Action,invoke:()=>void):void;
}
function copyNode(node:Node):Node {
  if(!node||typeof node.id!=='string'||!node.id||!roles.has(node.role)||!Array.isArray(node.bounds)||node.bounds.length!==4||!Array.from(node.bounds).every(Number.isFinite)||node.bounds[2]<0||node.bounds[3]<0)throw new TypeError('Invalid Native semantic identity, role or logical rectangle.');
  if(!Array.isArray(node.actions)||Array.from(node.actions).some(action=>!['tap','focus','increase','decrease'].includes(action)))throw new TypeError('Unsupported Native semantic action.');
  if([node.label,node.hint].some(value=>value!==undefined&&typeof value!=='string')||node.value!==undefined&&typeof node.value!=='string'&&!(typeof node.value==='number'&&Number.isFinite(node.value))||!node.state||typeof node.state!=='object'||Array.isArray(node.state)||Object.values(node.state).some(value=>typeof value!=='boolean'))throw new TypeError('Invalid Native semantic label, value or state.');
  return Object.freeze({...node,bounds:Object.freeze([...node.bounds]) as Node['bounds'],actions:Object.freeze([...node.actions]),state:Object.freeze({...node.state})});
}
function traits(node:Node):number {
  const values=new Set<number>();
  if(['button','checkbox','radio','switch','menu-item'].includes(node.role))values.add(UIAccessibilityTraitButton);
  if(node.role==='text'||node.role==='progress')values.add(UIAccessibilityTraitStaticText);
  if(node.role==='image')values.add(UIAccessibilityTraitImage);
  if(node.role==='link')values.add(UIAccessibilityTraitLink);
  if(node.role==='heading')values.add(UIAccessibilityTraitHeader);
  if(node.actions.includes('increase')||node.actions.includes('decrease'))values.add(UIAccessibilityTraitAdjustable);
  if(node.state.disabled)values.add(UIAccessibilityTraitNotEnabled);
  if(node.state.selected||node.state.checked||node.state.toggled)values.add(UIAccessibilityTraitSelected);
  // UIAccessibilityTraits is UInt64. Avoid JS's signed 32-bit bitwise operators.
  return [...values].reduce((sum,value)=>sum+value,UIAccessibilityTraitNone);
}
function visible(node:Node):boolean {return node.role!=='none'&&!node.state.hidden&&!node.state.obscured&&node.bounds[2]>0&&node.bounds[3]>0;}

/** One Player's UIKit semantic projection. Editing and every logical action remain with the original HYA/G06 owner. */
class IosHyaSemantics {
  readonly host:HyaSemanticHost;
  private readonly container=UIView.new();
  private readonly previousElement:boolean;
  private readonly entries=new Map<string,Entry>();
  private listener:Listener|null=null;
  private disposed=false;
  private suspended=false;
  private updating=false;
  private order='';
  private announcementRevision:number|undefined;
  private announcements=new Set<string>();
  constructor(private readonly view:UIView,private readonly options:Options) {
    if(typeof options?.record!=='function'||typeof options?.requestFrame!=='function'||options.beforeAction!==undefined&&typeof options.beforeAction!=='function')throw new TypeError('Native semantic callbacks are incomplete.');
    if(owners.has(view))throw new Error('This Native view already owns a HYA semantic projection.');
    owners.set(view,this);this.previousElement=view.isAccessibilityElement;
    const container=this.container;container.frame=view.bounds;container.autoresizingMask=UIViewAutoresizing.FlexibleWidth|UIViewAutoresizing.FlexibleHeight;
    container.isAccessibilityElement=false;container.userInteractionEnabled=false;
    container.accessibilityIdentifier='g11-hya-semantics';
    // An independent child container preserves the G06 UIKit responder and unrelated borrowed child views.
    view.isAccessibilityElement=false;
    try{view.addSubview(container);}catch(error){view.isAccessibilityElement=this.previousElement;owners.delete(view);throw error;}
    this.host=Object.freeze({update:(snapshot:HyaSemanticSnapshot)=>this.update(snapshot),subscribeActions:(listener:Listener)=>{
      this.live();if(this.listener)throw new Error('A Native semantic projection belongs to one Player subscription.');this.listener=listener;let closed=false;
      return{unsubscribe:()=>{if(closed)return;closed=true;if(this.listener===listener)this.listener=null;}};
    }});
  }
  private live():void {if(this.disposed)throw new Error('Native semantic projection is disposed.');}
  private record(event:string,detail:unknown):void {try{this.options.record(event,detail);}catch(error){console.error('Native semantic diagnostic failed',error);}}
  private apply(entry:Entry,node:Node):void {
    const element=entry.element;element.accessibilityIdentifier='g11-hya:'+node.id;
    element.isAccessibilityElement=visible(node);element.accessibilityElementsHidden=!visible(node);
    element.accessibilityLabel=node.label??'';
    const state=node.state.checked===undefined?(node.state.toggled===undefined?'':node.state.toggled?'On':'Off'):node.state.mixed?'Mixed':node.state.checked?'Checked':'Unchecked';
    element.accessibilityValue=node.value===undefined?state:String(node.value);
    element.accessibilityHint=node.hint??(node.role==='textbox'?'Double tap to edit with the native keyboard.':'');
    element.accessibilityTraits=traits(node);
    element.accessibilityFrameInContainerSpace=CGRectMake(...node.bounds);
  }
  private update(snapshot:HyaSemanticSnapshot):void {
    this.live();const next=new Map<string,Node>();
    for(const value of snapshot.nodes){const node=copyNode(value);if(next.has(node.id))throw new TypeError('Duplicate Native semantic identity.');next.set(node.id,node);}
    if(!Array.isArray(snapshot.readingOrder)||new Set(snapshot.readingOrder).size!==snapshot.readingOrder.length||Array.from(snapshot.readingOrder).some(id=>!next.has(id)))throw new TypeError('Invalid Native semantic reading order.');
    if(!Number.isSafeInteger(snapshot.revision)||!Array.isArray(snapshot.announcements)||Array.from(snapshot.announcements).some(item=>!item||typeof item.text!=='string'||!next.has(item.node)||!['polite','assertive'].includes(item.mode)))throw new TypeError('Invalid Native semantic announcement.');
    const created:Entry[]=[],applied:{entry:Entry;before:Node}[]=[];
    const previousElements=this.container.accessibilityElements,previousFrame=this.container.frame;
    const visibleIds=snapshot.readingOrder.filter(id=>visible(next.get(id)!)),order=JSON.stringify(visibleIds),orderChanged=order!==this.order;
    this.updating=true;
    try{
      for(const[id,node]of next){
        let entry=this.entries.get(id);
        if(entry){if(entry.key!==JSON.stringify(node)){applied.push({entry,before:entry.node});this.apply(entry,node);}}
        else{const element=HyaSceneAccessibilityElement.alloc().initWithAccessibilityContainer(this.container) as HyaSceneAccessibilityElement;element.nodeId=id;entry={element,node,key:JSON.stringify(node)};created.push(entry);this.apply(entry,node);}
      }
      const staged=new Map([...this.entries,...created.map(entry=>[entry.node.id,entry] as const)]);
      if(orderChanged)this.container.accessibilityElements=NSArray.arrayWithArray(visibleIds.map(id=>staged.get(id)!.element));
      if(JSON.stringify(this.container.frame)!==JSON.stringify(this.view.bounds))this.container.frame=this.view.bounds;
      for(const[id,entry]of this.entries)if(!next.has(id)){entry.element.owner=null;this.entries.delete(id);}
      for(const entry of created)this.entries.set(entry.node.id,entry);
      for(const[id,node]of next){const entry=this.entries.get(id)!;entry.node=node;entry.key=JSON.stringify(node);entry.element.owner=this;}
      this.order=order;
    }catch(error){
      const failures:unknown[]=[error];for(const old of applied)try{this.apply(old.entry,old.before);}catch(failure){failures.push(failure);}
      for(const entry of created)entry.element.owner=null;
      try{this.container.accessibilityElements=previousElements;this.container.frame=previousFrame;}catch(failure){failures.push(failure);}
      if(failures.length>1)throw new AggregateError(failures,'Native semantic update and rollback failed.');throw error;
    }finally{this.updating=false;}
    if(orderChanged&&!this.suspended)try{UIAccessibilityPostNotification(UIAccessibilityLayoutChangedNotification,null);}catch(error){this.record('native-semantic-notification-error',{error:String(error)});}
    if(this.disposed)return;
    if(this.announcementRevision!==snapshot.revision){this.announcementRevision=snapshot.revision;this.announcements.clear();}
    for(const item of snapshot.announcements){
      const key=JSON.stringify(item);if(this.announcements.has(key))continue;this.announcements.add(key);
      if(this.suspended||!next.has(item.node)||!visible(next.get(item.node)!))continue;
      const text=NSMutableAttributedString.alloc().initWithString(item.text);
      text.addAttributeValueRange(UIAccessibilitySpeechAttributeQueueAnnouncement,NSNumber.numberWithBool(item.mode==='polite'),{location:0,length:item.text.length});
      try{UIAccessibilityPostNotification(UIAccessibilityAnnouncementNotification,text);}catch(error){this.record('native-semantic-notification-error',{error:String(error)});}
    }
  }
  activate(element:HyaSceneAccessibilityElement):boolean {
    const node=this.entries.get(element.nodeId)?.node;
    return node?this.perform(element,node.actions.includes('tap')?'tap':'focus'):false;
  }
  perform(element:HyaSceneAccessibilityElement,action:Action):boolean {
    const valid=()=>!this.disposed&&!this.suspended&&!this.updating&&this.listener!==null&&this.entries.get(element.nodeId)?.element===element;
    if(!valid())return false;const entry=this.entries.get(element.nodeId)!;
    const allowed=()=>visible(entry.node)&&!entry.node.state.disabled&&!(entry.node.state.readOnly&&['increase','decrease'].includes(action))&&entry.node.actions.includes(action);
    if(!allowed())return false;
    let invoked=false,accepted=true;
    const invoke=()=>{if(invoked)return;invoked=true;if(!valid()||!allowed()){accepted=false;return;}try{this.listener!(element.nodeId,action);if(!this.disposed)this.options.requestFrame();this.record('native-semantic-action',{node:element.nodeId,action,accepted:true});}catch(error){accepted=false;this.record('native-semantic-action-error',{node:element.nodeId,action,error:String(error)});}};
    try{if(this.options.beforeAction)this.options.beforeAction(element.nodeId,action,invoke);else invoke();return accepted;}
    catch(error){this.record('native-semantic-action-error',{node:element.nodeId,action,error:String(error)});return false;}
  }
  suspend():void {if(this.disposed)return;this.suspended=true;this.container.accessibilityElementsHidden=true;}
  resume():void {this.live();this.suspended=false;this.container.accessibilityElementsHidden=false;}
  snapshot(){return{disposed:this.disposed,suspended:this.suspended,nodes:this.entries.size,subscribed:this.listener!==null,order:this.order};}
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.listener=null;
    for(const entry of this.entries.values())entry.element.owner=null;this.entries.clear();this.announcements.clear();
    const errors:unknown[]=[];
    for(const release of [()=>{this.container.accessibilityElements=NSArray.arrayWithArray([]);},()=>this.container.removeFromSuperview(),()=>{if(!this.view.isAccessibilityElement)this.view.isAccessibilityElement=this.previousElement;}])try{release();}catch(error){errors.push(error);}
    if(owners.get(this.view)===this)owners.delete(this.view);
    if(errors.length)throw new AggregateError(errors,'Native semantic projection cleanup failed.');
  }
}
export const createIosHyaSemanticsHost=(view:UIView,options:Options)=>new IosHyaSemantics(view,options);
