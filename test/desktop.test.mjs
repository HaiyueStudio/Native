import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';
test('platform policy does not infer ad availability from iOS compatibility',()=>{
 const {capabilityPolicy:p}=loadTS('bridge/platform/capabilities.ts');
 assert.equal(p('ios',true,true,true).device,'ios-on-mac');assert.equal(p('ios',true,true,true).rewardedAds,'unverified');
 assert.equal(p('ios',false,true,true).device,'ipad');assert.equal(p('ios',false,false,false).camera,false);assert.equal(p('android',false,false,true).rewardedAds,'available');
});
test('window observer deduplicates layout, updates insets/scale and unsubscribes',()=>{
 const events=()=>({listeners:new Map(),on(k,f){this.listeners.set(k,f)},off(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k)}});
 const view=events(),app=Object.assign(events(),{resumeEvent:'resume'}),changes=[];
 let m={width:0,height:0,scale:2,safeArea:{top:0,right:0,bottom:0,left:0}};
 const {NativeWindowObserver}=loadTS('bridge/platform/window.ts',{'@nativescript/core':{Application:app},'./window-metrics':{windowMetrics:()=>m}});
 const o=new NativeWindowObserver(view,v=>changes.push(v));assert.equal(changes.length,0);
 m={...m,width:800,height:600};o.refresh();o.refresh();assert.equal(changes.length,1);
 m={...m,scale:1,safeArea:{top:20,right:0,bottom:0,left:0}};app.listeners.get('resume')();assert.equal(changes.length,2);
 o.dispose();o.dispose();assert.equal(view.listeners.size,0);assert.equal(app.listeners.size,0);o.refresh();assert.equal(changes.length,2);
});
test('wheel shares window coordinates, reports claim and stops on suspension/disposal',()=>{
 const {OrbitPointerTarget}=loadTS('bridge/input/pointer-target.ts');const t=new OrbitPointerTarget(()=>({x:10,y:59,width:600,height:500}));
 let count=0;t.addEventListener('wheel',e=>{count++;assert.equal(e.clientY,159);assert.equal(e.deltaY,-20);e.preventDefault();});
 const e={clientX:120,clientY:159,deltaX:0,deltaY:-20,deltaMode:0};assert(t.wheel(e));t.suspend();assert(!t.wheel(e));t.resume();assert(t.wheel(e));t.dispose();assert(!t.wheel(e));assert.equal(count,2);
});
test('unverified desktop ads never initialize SDK or grant a reward by default',async()=>{
 let created=0,earned=0;class Ads{constructor(){created++;}}
 const {AdMobRewardGateway}=loadTS('bridge/rewards/admob.ts',{'@nativescript/core':{isIOS:true,Connectivity:{getConnectionType:()=>1,connectionType:{none:0}}},'../platform/runtime':{getNativeCapabilities:()=>({rewardedAds:'unverified'})}}, {HYRewardedAds:Ads});
 const gateway=new AdMobRewardGateway({iosUnit:'',androidUnit:''});await gateway.initialize(true,async()=>true);assert.equal(gateway.privacyRequired(),false);
 await assert.rejects(gateway.show(()=>earned++),e=>e.failure.code==='unsupported_platform');assert.equal(created,0);assert.equal(earned,0);
});
test('key matching requires exact modifiers',()=>{
 const {matchesKey}=loadTS('bridge/input/desktop-types.ts');const key={key:'Z',metaKey:true,ctrlKey:false,altKey:false,shiftKey:false,repeat:false};
 assert(matchesKey({key:'z',metaKey:true},key));assert(!matchesKey({key:'z',ctrlKey:true},key));assert(!matchesKey({key:'z',metaKey:true},{...key,altKey:true}));
});
test('iOS desktop bridge keeps text focus, gates input and detaches native observers',()=>{
 const array=values=>({count:values.length,objectAtIndex:i=>values[i],indexOfObject:v=>values.indexOf(v),values});
 class Obj{static new(){return new this()}static alloc(){return new this()}}
 class View extends Obj{
  subviews=array([]);isFirstResponder=false;superview=null;window=null;recognizers=[];
  addSubview(v){this.subviews.values.push(v);this.subviews.count++;v.superview=this;v.window=this.window}
  removeFromSuperview(){this.superview=null}becomeFirstResponder(){this.isFirstResponder=true;return true}resignFirstResponder(){this.isFirstResponder=false;return true}
  addGestureRecognizer(g){this.recognizers.push(g);g.view=this}removeGestureRecognizer(g){this.recognizers=this.recognizers.filter(x=>x!==g);g.view=null}
 }
 class Pan extends Obj{initWithTargetAction(target){this.target=target;return this}translationInView(){return {x:2,y:5}}setTranslationInView(){}locationInView(){return{x:120,y:159}}}
 const root=new View();root.window=root;
 const host={nativeViewProtected:root,listeners:new Map(),on(k,f){this.listeners.set(k,f)},off(k){this.listeners.delete(k)}};
 const commands=[],wheel=[];let enabled=true,keyboard=true;
 const globals={NativeClass:()=>v=>v,UIView:View,NSObject:Obj,UIPanGestureRecognizer:Pan,UIKeyCommand:{keyCommandWithInputModifierFlagsAction:(input,flags)=>({input,flags})},NSArray:{arrayWithArray:array},interop:{types:{void:0}},CGRectMake:()=>({}),CGPointMake:(x,y)=>({x,y}),UIScrollTypeMask:{All:3},UIKeyModifierFlags:{Command:1,Control:2,Alternate:4,Shift:8},UIKeyInputUpArrow:'up',UIKeyInputDownArrow:'down',UIKeyInputLeftArrow:'left',UIKeyInputRightArrow:'right',UIKeyInputEscape:'escape'};
 const {NativeDesktopInput}=loadTS('bridge/input/desktop.ios.ts',{},globals);
 const input=new NativeDesktopInput(host,{bindings:[{key:'z',metaKey:true}],enabled:()=>enabled,keyboardEnabled:()=>keyboard,onKey:e=>commands.push(e),onWheel:e=>wheel.push(e)});
 const responder=root.subviews.objectAtIndex(0);input.focus();assert(responder.isFirstResponder);
 input.command(input.commands.objectAtIndex(0));assert.equal(commands.length,1);assert(commands[0].metaKey);
 keyboard=false;assert.equal(responder.keyCommands.count,0);input.command(input.commands.objectAtIndex(0));assert.equal(commands.length,1);
 input.scroll(root.recognizers[0]);assert.equal(wheel[0].clientY,159);assert.equal(wheel[0].deltaY,-5);
 input.suspend();input.scroll(root.recognizers[0]);assert.equal(wheel.length,1);
 const text=new View();text.isFirstResponder=true;root.addSubview(text);input.resume();assert(!responder.isFirstResponder);
 text.isFirstResponder=false;enabled=false;input.focus();assert(!responder.isFirstResponder);
 input.dispose();input.dispose();assert.equal(root.recognizers.length,0);assert.equal(host.listeners.size,0);
});
test('unverified desktop ad opt-in is honored only in native Debug builds',async()=>{
 for(const debug of [false,true]){
  const units=[];class Ads{configurePolicy(){return true}performUnitEvents(action,unit,callback){units.push(unit);callback('closed')}}
  const {AdMobRewardGateway}=loadTS('bridge/rewards/admob.ts',{'@nativescript/core':{isIOS:true,Connectivity:{getConnectionType:()=>1,connectionType:{none:0}}},'../platform/runtime':{getNativeCapabilities:()=>({rewardedAds:'unverified'})}}, {HYRewardedAds:Ads,NSBundle:{mainBundle:{objectForInfoDictionaryKey:()=>debug?'Debug':'Release'}}});
  const gateway=new AdMobRewardGateway({iosUnit:'',androidUnit:'',allowUnverifiedDesktopAds:true});
  if(debug){await gateway.show(()=>{});assert.equal(units[0],'ca-app-pub-3940256099942544/1712485313');}
  else {await assert.rejects(gateway.show(()=>{}),e=>e.failure.code==='unsupported_platform');assert.equal(units.length,0);}
 }
});
test('all orientation policy includes all four iPad orientations without broadening legacy any',()=>{
 const {orientationMask,orientationPlistValues,assertOrientationSupported}=loadTS('bridge/display/orientation-policy.ts');
 assert.equal(orientationMask('all'),30);assert.equal(orientationMask('any'),26);assert.equal(orientationPlistValues('all').length,4);
 assertOrientationSupported('all','all');assert.throws(()=>assertOrientationSupported('all','any'));
});
