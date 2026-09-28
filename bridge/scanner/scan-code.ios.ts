import {Application,Utils} from '@nativescript/core';
import {scanText,scanLimit,type ScanCodeOptions,type ScannedCode} from './types';
export type {ScanCodeOptions,ScannedCode} from './types';
let cancel:(()=>void)|null=null;
export function cancelScan(){cancel?.();}
@NativeClass()
class CodeDelegate extends NSObject implements AVCaptureMetadataOutputObjectsDelegate {
 static ObjCProtocols=[AVCaptureMetadataOutputObjectsDelegate];
 receive:((text:string)=>void)|null=null;
 captureOutputDidOutputMetadataObjectsFromConnection(_output:AVCaptureOutput,objects:NSArray<any>,_connection:AVCaptureConnection){
  for(let i=0;i<objects.count;i++){const object=objects.objectAtIndex(i);if(object.type===AVMetadataObjectTypeQRCode&&object.stringValue){this.receive?.(String(object.stringValue));break;}}
 }
}
@NativeClass()
class CodeController extends UIViewController {
 static ObjCExposedMethods={closeScanner:{returns:interop.types.void,params:[]}};
 session!:AVCaptureSession; preview!:AVCaptureVideoPreviewLayer; closeButton!:UIButton; onClose:(()=>void)|null=null;
 viewDidLayoutSubviews(){super.viewDidLayoutSubviews();if(this.preview)this.preview.frame=this.view.bounds;if(this.closeButton)this.closeButton.frame=CGRectMake(16,this.view.safeAreaInsets.top+12,120,48);}
 closeScanner(){this.onClose?.();}
 viewDidDisappear(animated:boolean){super.viewDidDisappear(animated);this.onClose?.();}
}
export async function scanCode(options:ScanCodeOptions={}):Promise<ScannedCode|null>{
 scanLimit(options);
 if(cancel)throw Error('Scanner already open');
 // Reserve immediately, including while the permission sheet is on screen.
 let cancelled=false;cancel=()=>{cancelled=true;};
 try {
  const allowed=await new Promise<boolean>(resolve=>AVCaptureDevice.requestAccessForMediaTypeCompletionHandler(AVMediaTypeVideo,resolve));
  if(cancelled){cancel=null;return null;}if(!allowed)throw Error('Camera permission denied');
  return await new Promise<ScannedCode|null>((resolve,reject)=>Utils.executeOnMainThread(()=>{
   if(cancelled){cancel=null;resolve(null);return;}
   let finished=false;const controller=CodeController.new() as CodeController,delegate=CodeDelegate.new() as CodeDelegate,session=AVCaptureSession.new();
   const finish=(result:ScannedCode|null,error?:unknown)=>{if(finished)return;finished=true;session.stopRunning();delegate.receive=null;controller.onClose=null;cancel=null;controller.dismissViewControllerAnimatedCompletion(true,()=>{});error?reject(error):resolve(result);};
   cancel=()=>finish(null);controller.onClose=()=>finish(null);
   try{
    const device=AVCaptureDevice.defaultDeviceWithMediaType(AVMediaTypeVideo);if(!device)throw Error('Camera unavailable');
    const input=AVCaptureDeviceInput.deviceInputWithDeviceError(device),output=AVCaptureMetadataOutput.new();
    if(!session.canAddInput(input)||!session.canAddOutput(output))throw Error('Camera configuration failed');session.addInput(input);session.addOutput(output);
    output.setMetadataObjectsDelegateQueue(delegate,NSOperationQueue.mainQueue.underlyingQueue);output.metadataObjectTypes=NSArray.arrayWithArray([AVMetadataObjectTypeQRCode]);
    delegate.receive=text=>{try{finish(scanText(text,options));}catch(e){finish(null,e);}};
    controller.session=session;controller.modalPresentationStyle=UIModalPresentationStyle.FullScreen;controller.view.backgroundColor=UIColor.blackColor;
    const preview=AVCaptureVideoPreviewLayer.layerWithSession(session);preview.videoGravity=AVLayerVideoGravityResizeAspectFill;controller.preview=preview;controller.view.layer.addSublayer(preview);
    const button=UIButton.buttonWithType(UIButtonType.System);button.setTitleForState(options.cancelLabel??'Cancel',UIControlState.Normal);button.backgroundColor=UIColor.blackColor;button.setTitleColorForState(UIColor.whiteColor,UIControlState.Normal);button.addTargetActionForControlEvents(controller,'closeScanner',UIControlEvents.TouchUpInside);controller.closeButton=button;controller.view.addSubview(button);
    let host=Application.ios.rootController;while(host?.presentedViewController)host=host.presentedViewController;if(!host)throw Error('No foreground view');
    host.presentViewControllerAnimatedCompletion(controller,true,()=>{if(!finished)session.startRunning();});
   }catch(e){finish(null,e);}
  }));
 }catch(error){cancel=null;throw error;}
}
