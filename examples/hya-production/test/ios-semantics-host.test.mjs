import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {createHyaPlayer} from '@haiyue/extensions/hya-player';

mkdirSync(new URL('../artifacts/',import.meta.url),{recursive:true});
const temp=mkdtempSync(new URL('../artifacts/ios-semantics-boundary-',import.meta.url)),source=readFileSync(new URL('../src/ios-semantics-host.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,experimentalDecorators:true}}).outputText;
writeFileSync(resolve(temp,'host.js'),js);writeFileSync(resolve(temp,'package.json'),'{"type":"module","private":true}\n');
const notifications=[];let failLabel=false,arrayWrites=0;
class View {
 static new(){return new this();}
 constructor(){this.subviews=[];this.isAccessibilityElement=true;this.bounds={origin:{x:0,y:0},size:{width:390,height:844}};this.frame=this.bounds;this._elements=null;}
 set accessibilityElements(value){arrayWrites++;this._elements=value;}get accessibilityElements(){return this._elements;}
 addSubview(view){this.subviews.push(view);view.parent=this;}
 removeFromSuperview(){if(this.parent){this.parent.subviews=this.parent.subviews.filter(view=>view!==this);this.parent=null;}}
}
class Element {
 static alloc(){return new this();}initWithAccessibilityContainer(container){this.accessibilityContainer=container;return this;}
 set accessibilityLabel(value){if(failLabel&&value==='changed'){failLabel=false;throw Error('mock native label failure');}this._label=value;}get accessibilityLabel(){return this._label;}
}
class Attributed {static alloc(){return new this();}initWithString(text){this.text=text;return this;}addAttributeValueRange(key,value,range){this.attribute={key,value,range};}}
const globals={UIView:View,UIAccessibilityElement:Element,NativeClass:()=>value=>value,UIViewAutoresizing:{FlexibleWidth:1,FlexibleHeight:2},NSArray:{arrayWithArray:values=>[...values]},CGRectMake:(x,y,width,height)=>({origin:{x,y},size:{width,height}}),NSMutableAttributedString:Attributed,NSNumber:{numberWithBool:value=>value},UIAccessibilitySpeechAttributeQueueAnnouncement:'queue',UIAccessibilityLayoutChangedNotification:100,UIAccessibilityAnnouncementNotification:101,UIAccessibilityPostNotification:(type,value)=>notifications.push({type,value})};
for(const[name,bit]of Object.entries({None:0,Button:2**40,StaticText:2,Image:4,Link:8,Header:16,Adjustable:32,NotEnabled:64,Selected:2**42}))globals['UIAccessibilityTrait'+name]=bit;
const originals=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true});
after(()=>{for(const[key,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);});
const {createIosHyaSemanticsHost}=await import(pathToFileURL(resolve(temp,'host.js')));
const node=(id,extra={})=>({id,target:id,role:'button',label:id,bounds:[20,30,100,40],actions:['tap'],state:{},...extra});
const frame=(nodes,extra={})=>({revision:1,nodes,readingOrder:nodes.map(value=>value.id),navigationOrder:nodes.map(value=>value.id),announcements:[],...extra});
const create=(options={})=>{const view=new View(),events=[],actions=[];let requests=0;const owner=createIosHyaSemanticsHost(view,{record:(event,detail)=>events.push({event,detail}),requestFrame:()=>requests++,...options});const lease=owner.host.subscribeActions((id,action)=>actions.push({id,action}));return{view,owner,lease,events,actions,get requests(){return requests;},get container(){return view.subviews.at(-1);}};};
test('UIKit projection uses public rectangles/order and keeps unrelated/native editor children',()=>{
 const h=create(),peer=new View();h.view.addSubview(peer);h.owner.host.update(frame([node('a'),node('field',{role:'textbox',value:'你好',actions:['focus'],bounds:[3.5,7,120,50]})],{readingOrder:['field','a']}));
 const container=h.view.subviews[0],elements=container.accessibilityElements;assert.equal(h.view.isAccessibilityElement,false);assert.equal(h.view.subviews[1],peer);assert.equal(elements[0].accessibilityValue,'你好');assert.deepEqual(elements[0].accessibilityFrameInContainerSpace,CGRectMake(3.5,7,120,50));assert.equal(elements[0].accessibilityActivate(),true);assert.deepEqual(h.actions,[{id:'field',action:'focus'}]);assert.equal(h.requests,1);
 h.owner.dispose();assert.deepEqual(h.view.subviews,[peer]);assert.equal(h.view.isAccessibilityElement,true);assert.equal(elements[0].accessibilityActivate(),false);h.owner.dispose();
});
test('stable nodes retain OS identity and identical updates do not replace the native collection or notify each frame',()=>{
 const h=create(),snapshot=frame([node('a')]);h.owner.host.update(snapshot);const first=h.container.accessibilityElements[0],writes=arrayWrites,before=notifications.length;
 h.owner.host.update(snapshot);assert.equal(h.container.accessibilityElements[0],first);assert.equal(arrayWrites,writes);assert.equal(notifications.length,before);
 h.owner.host.update(frame([node('a',{value:6,bounds:[10,20,30,40]})],{revision:2}));assert.equal(h.container.accessibilityElements[0],first);assert.equal(first.accessibilityValue,'6');assert.deepEqual(first.accessibilityFrameInContainerSpace,CGRectMake(10,20,30,40));assert.equal(notifications.length,before);h.owner.dispose();
});
test('hidden/obscured/empty nodes are absent; disabled/read-only actions reject; UInt64 traits stay intact',()=>{
 const h=create();h.owner.host.update(frame([node('disabled',{state:{disabled:true,selected:true}}),node('hidden',{state:{hidden:true}}),node('empty',{bounds:[0,0,0,10]}),node('obscured',{state:{obscured:true}}),node('read',{role:'slider',state:{readOnly:true},actions:['increase']})]));
 const elements=h.container.accessibilityElements;assert.equal(elements.length,2);assert.equal(elements[0].accessibilityTraits,2**40+2**42+64);assert.equal(elements[0].accessibilityActivate(),false);elements[1].accessibilityIncrement();assert.deepEqual(h.actions,[]);h.owner.dispose();
});
test('removed identity, unsubscribe, suspend and disposal all silence actual OS callbacks',()=>{
 const h=create();h.owner.host.update(frame([node('a')]));const old=h.container.accessibilityElements[0];h.owner.suspend();assert.equal(old.accessibilityActivate(),false);assert.equal(h.container.accessibilityElementsHidden,true);h.owner.resume();assert.equal(old.accessibilityActivate(),true);
 h.owner.host.update(frame([],{revision:2}));h.owner.host.update(frame([node('a')],{revision:3}));assert.equal(old.accessibilityActivate(),false);assert.notEqual(h.container.accessibilityElements[0],old);h.lease.unsubscribe();h.lease.unsubscribe();assert.equal(h.container.accessibilityElements[0].accessibilityActivate(),false);h.owner.dispose();assert.equal(h.owner.snapshot().nodes,0);
});
test('a delayed audio-unlock action cannot reach a removed/reused semantic node',()=>{
 let pending;const h=create({beforeAction(_id,_action,invoke){pending=invoke;}});h.owner.host.update(frame([node('a')]));assert.equal(h.container.accessibilityElements[0].accessibilityActivate(),true);assert.deepEqual(h.actions,[]);
 h.owner.host.update(frame([]));h.owner.host.update(frame([node('a')]));pending();assert.deepEqual(h.actions,[]);h.owner.dispose();
});
test('native property failure rolls back old fields/collection and does not adopt new entries',()=>{
 const h=create();h.owner.host.update(frame([node('a')]));const collection=h.container.accessibilityElements,element=collection[0];failLabel=true;
 assert.throws(()=>h.owner.host.update(frame([node('new'),node('a',{label:'changed',bounds:[1,2,3,4]})],{revision:2})),/mock native label failure/);
 assert.equal(h.container.accessibilityElements,collection);assert.equal(h.owner.snapshot().nodes,1);assert.equal(element.accessibilityLabel,'a');assert.deepEqual(element.accessibilityFrameInContainerSpace,CGRectMake(20,30,100,40));assert.equal(element.accessibilityActivate(),true);h.owner.dispose();
});
test('announcements are revision-deduplicated, queue polite output and suppress hidden/background output',()=>{
 const h=create(),announcement={node:'a',mode:'polite',text:'Saved'};const before=notifications.length;h.owner.host.update(frame([node('a')],{announcements:[announcement]}));h.owner.host.update(frame([node('a')],{announcements:[announcement]}));
 const output=notifications.slice(before).filter(value=>value.type===101);assert.equal(output.length,1);assert.equal(output[0].value.text,'Saved');assert.equal(output[0].value.attribute.value,true);
 h.owner.suspend();h.owner.host.update(frame([node('a')],{revision:2,announcements:[{...announcement,mode:'assertive'}]}));assert.equal(notifications.slice(before).filter(value=>value.type===101).length,1);h.owner.dispose();
});
test('invalid semantic frames fail before changing existing native state; ownership is exclusive',()=>{
 const h=create();h.owner.host.update(frame([node('a')]));const old=h.container.accessibilityElements;
 for(const nodes of [[node('a'),node('a')],[node('bad',{bounds:[0,NaN,1,1]})],[node('bad',{role:'invented'})],[node('bad',{state:{disabled:'yes'}})]])assert.throws(()=>h.owner.host.update(frame(nodes)),TypeError);
 assert.equal(h.container.accessibilityElements,old);assert.throws(()=>createIosHyaSemanticsHost(h.view,{record(){},requestFrame(){}}),/already owns/);h.owner.dispose();const next=createIosHyaSemanticsHost(h.view,{record(){},requestFrame(){}});next.dispose();
});
test('each native action invokes once; throwing callbacks and reentrant disposal stay within the host boundary',()=>{
 const h=create({beforeAction(_id,_action,invoke){invoke();invoke();}});h.owner.host.update(frame([node('a')]));assert.equal(h.container.accessibilityElements[0].accessibilityActivate(),true);assert.equal(h.actions.length,1);h.lease.unsubscribe();
 h.owner.host.subscribeActions(()=>{throw Error('consumer action failed');});assert.equal(h.container.accessibilityElements[0].accessibilityActivate(),false);assert.ok(h.events.some(value=>value.event==='native-semantic-action-error'));h.owner.dispose();
 const view=new View();let requests=0,owner;owner=createIosHyaSemanticsHost(view,{record(){},requestFrame(){requests++;}});owner.host.subscribeActions(()=>owner.dispose());owner.host.update(frame([node('a')]));const element=view.subviews[0].accessibilityElements[0];assert.equal(element.accessibilityActivate(),true);assert.equal(requests,0);assert.equal(element.accessibilityActivate(),false);assert.equal(owner.snapshot().disposed,true);
});
test('actual seven-part public player accepts qualified OS identity and commits original data/state/audio once',async()=>{
 const assets=new URL('../src/assets/',import.meta.url),source=JSON.parse(readFileSync(new URL('scene.json',assets),'utf8')),manifest=JSON.parse(readFileSync(new URL('manifest.json',assets),'utf8'));
 const view=new View(),events=[],owner=createIosHyaSemanticsHost(view,{record:(event,detail)=>events.push({event,detail}),requestFrame(){}});let state='suspended',scheduled=0,decoded=0,released=0,acquired=0,retired=0;
 const resources={async acquire(request){const asset=manifest.assets[request.asset==='core-image'?'alternate':request.asset];const value=new Uint8Array(readFileSync(new URL(asset.file,assets)));acquired++;let closed=false;return{value,generation:1,bytes:value.byteLength,release(){assert.equal(closed,false);closed=true;retired++;}};}};
 const audio={profile:'sample-accurate',sampleRate:48000,get state(){return state;},nowFrame:()=>0,async unlock(){state='running';},async decode(resource,signal,buffer){assert.equal(signal.aborted,false);assert.equal(createHash('sha256').update(new Uint8Array(buffer)).digest('hex'),resource.integrity.digest);const view=new DataView(buffer),pcm=Float32Array.from({length:resource.frameLength},(_,index)=>view.getInt16(44+index*2,true)/32768);decoded++;return{value:pcm,sampleRate:48000,channels:1,frames:pcm.length,bytes:pcm.byteLength,release(){released++;}};},schedule(request){scheduled++;assert.ok(request.value instanceof Float32Array);return{stop(){},setGain(){},setRate(){},release(){}};}};
 const player=await createHyaPlayer(source,{mode:'evaluate',viewport:[390,844],dpr:2,host:{capabilities:new Set(source.parts.map(part=>part.extension)),resources,audio,semantics:owner.host,invalidate(){}}});
 const advance=async sequence=>{for(let index=0;index<128;index++){const frame=player.advance({sequence,deltaSeconds:0,viewport:[390,844],dpr:2});if(frame.ready)return frame;await new Promise(resolve=>setTimeout(resolve,0));}throw Error('Native public scene did not settle.');};
 try{
  const before=await advance(1),button=before.semantics.nodes.find(node=>node.target==='button.alias');assert.deepEqual(JSON.parse(button.id),['semantics','activate']);
  const element=view.subviews[0].accessibilityElements.find(value=>value.accessibilityIdentifier==='g11-hya:'+button.id);assert.ok(element);
  await player.unlockAudio();assert.equal(element.accessibilityActivate(),true);const changed=await advance(2);
  assert.equal(player.data.read('root',['label']),'你好世界');assert.equal(player.data.read('root',['go']),true);
  assert.equal(changed.events.filter(value=>value.kind==='activated').length,1);
  assert.equal(view.subviews[0].accessibilityElements.find(value=>value.accessibilityIdentifier==='g11-hya:'+changed.semantics.nodes.find(node=>node.role==='textbox').id).accessibilityValue,'你好世界');
  for(let index=0;index<128&&scheduled===0;index++)await new Promise(resolve=>setTimeout(resolve,0));assert.equal(scheduled,1);assert.equal(events.filter(value=>value.event==='native-semantic-action').length,1);
 }finally{player.dispose();owner.dispose();}
 assert.equal(decoded,released);assert.equal(acquired,retired);
});
