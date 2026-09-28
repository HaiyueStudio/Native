import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';

function android() {
 const listeners=new Set(), opened=[], closed=[];
 let fail=false;
 const activity={finishActivity:code=>closed.push(code)};
 const app={foregroundActivity:activity,activityResultEvent:'result',on:(_,f)=>listeners.add(f),off:(_,f)=>listeners.delete(f)};
 class Integrator {
  static parseActivityResult(_code,intent){return {getContents:()=>intent?.text??null};}
  setRequestCode(code){this.code=code;} setDesiredBarcodeFormats(){} setPrompt(){} setBeepEnabled(){} setBarcodeImageEnabled(){} setOrientationLocked(){}
  initiateScan(){if(fail)throw Error('Camera unavailable');opened.push(this.code);}
 }
 const api=loadTS('bridge/scanner/scan-code.android.ts',{'@nativescript/core':{Application:{android:app}}},{com:{google:{zxing:{integration:{android:{IntentIntegrator:Integrator}}}}},java:{util:{ArrayList:class{add(){}}}}});
 return {...api,app,opened,closed,listeners,setFail:v=>fail=v,emit:(code,text,denied=false)=>{for(const f of [...listeners])f({requestCode:code,resultCode:0,intent:{text,getBooleanExtra:()=>denied}});}};
}
test('Android scanner cancellation releases listener and ignores stale results after reopen',async()=>{
 const f=android(), first=f.scanCode();await assert.rejects(f.scanCode(),/already open/);
 const old=f.opened[0];f.cancelScan();assert.equal(await first,null);assert.equal(f.listeners.size,0);
 const next=f.scanCode();f.emit(old,'stale');assert.equal(f.listeners.size,1);
 f.emit(f.opened[1],'current');assert.equal((await next).text,'current');assert.equal(f.listeners.size,0);
 f.cancelScan();assert.equal(f.closed.length,1);
});
test('Android scanner validates payload, permissions and setup failures and can retry',async()=>{
 const f=android();
 for(const mode of ['denied','oversize','cancel','setup']){
  f.setFail(mode==='setup');const run=f.scanCode({maxTextLength:3});
  if(mode!=='setup')f.emit(f.opened.at(-1),mode==='oversize'?'1234':null,mode==='denied');
  if(mode==='cancel')assert.equal(await run,null);else await assert.rejects(run);
  assert.equal(f.listeners.size,0);
 }
 f.setFail(false);const run=f.scanCode();f.emit(f.opened.at(-1),'https://example.com');assert.equal((await run).text,'https://example.com');
});

function ios(){
 let permission,controller,delegate;const queue=[],sessions=[];
 class Obj{static new(){return new this();}}
 class VC extends Obj{view={bounds:{},safeAreaInsets:{top:0},layer:{addSublayer(){}},addSubview(){}};dismissViewControllerAnimatedCompletion(){this.viewDidDisappear(true);}viewDidDisappear(){} viewDidLayoutSubviews(){}}
 const host={presentViewControllerAnimatedCompletion(c,_a,done){controller=c;done();}};
 class Session extends Obj{running=false;constructor(){super();sessions.push(this);}canAddInput(){return true;}canAddOutput(){return true;}addInput(){}addOutput(){}startRunning(){this.running=true;}stopRunning(){this.running=false;}}
 class Output extends Obj{setMetadataObjectsDelegateQueue(d){delegate=d;}}
 const api=loadTS('bridge/scanner/scan-code.ios.ts',{'@nativescript/core':{Application:{ios:{rootController:host}},Utils:{executeOnMainThread:f=>queue.push(f)}}},{
  NativeClass:()=>c=>c,NSObject:Obj,UIViewController:VC,AVCaptureMetadataOutputObjectsDelegate:{},interop:{types:{void:0}},
  AVCaptureDevice:{requestAccessForMediaTypeCompletionHandler:(_t,cb)=>{permission=cb;},defaultDeviceWithMediaType:()=>({})},AVMediaTypeVideo:'video',AVCaptureSession:Session,
  AVCaptureDeviceInput:{deviceInputWithDeviceError:()=>({})},AVCaptureMetadataOutput:Output,NSOperationQueue:{mainQueue:{underlyingQueue:{}}},NSArray:{arrayWithArray:a=>a},AVMetadataObjectTypeQRCode:'qr',
  UIModalPresentationStyle:{FullScreen:0},UIColor:{blackColor:0,whiteColor:1},AVCaptureVideoPreviewLayer:{layerWithSession:()=>({})},AVLayerVideoGravityResizeAspectFill:0,
  UIButton:{buttonWithType:()=>({setTitleForState(){},setTitleColorForState(){},addTargetActionForControlEvents(){}})},UIButtonType:{System:0},UIControlState:{Normal:0},UIControlEvents:{TouchUpInside:0},
 });
 return {...api,sessions,permit:async allowed=>{permission(allowed);await new Promise(resolve=>setImmediate(resolve));},flush:()=>{while(queue.length)queue.shift()();},emit:text=>delegate.captureOutputDidOutputMetadataObjectsFromConnection(null,{count:1,objectAtIndex:()=>({type:'qr',stringValue:text})},null),close:()=>controller.closeScanner()};
}
test('iOS scanner reserves permission and honours cancel before main-thread presentation',async()=>{
 const f=ios();let run=f.scanCode();await assert.rejects(f.scanCode(),/already open/);f.cancelScan();await f.permit(true);assert.equal(await run,null);assert.equal(f.sessions.length,0);
 run=f.scanCode();await f.permit(true);f.cancelScan();f.flush();assert.equal(await run,null);assert.equal(f.sessions.length,0);
});
test('iOS scanner cleans camera on success, invalid payload, denial and repeated dismissal',async()=>{
 const f=ios();let run=f.scanCode();const denied=assert.rejects(run,/permission denied/);await f.permit(false);await denied;
 run=f.scanCode();await f.permit(true);f.flush();assert.equal(f.sessions.at(-1).running,true);f.emit('hello');assert.equal((await run).text,'hello');assert.equal(f.sessions.at(-1).running,false);
 run=f.scanCode({maxTextLength:1});await f.permit(true);f.flush();f.emit('long');await assert.rejects(run,/oversized/);assert.equal(f.sessions.at(-1).running,false);
 run=f.scanCode();await f.permit(true);f.flush();f.close();f.close();f.cancelScan();assert.equal(await run,null);assert.equal(f.sessions.at(-1).running,false);
});
