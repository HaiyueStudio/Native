import {Application,Utils} from '@nativescript/core';
import {scanImageTexts,type ScanCodeOptions,type ScannedCode} from './types';
// CoreImage is a system framework but is not included in NativeScript's default
// ambient framework declarations. Keep its small boundary local to this adapter.
interface QRImage {extent:CGRect;imageByApplyingTransform(transform:CGAffineTransform):QRImage;}
declare const CIImage:{imageWithContentsOfURL(url:NSURL):QRImage|null};
declare const CIDetector:{detectorOfTypeContextOptions(type:string,context:null,options:unknown):{featuresInImage(image:QRImage):NSArray<{messageString:string|null}>}};
declare const CIDetectorTypeQRCode:string,CIDetectorAccuracy:string,CIDetectorAccuracyHigh:string;
@NativeClass()
class PhotoDelegate extends NSObject implements PHPickerViewControllerDelegate {
 static ObjCProtocols=[PHPickerViewControllerDelegate];
 receive:((results:NSArray<PHPickerResult>)=>void)|null=null;
 pickerDidFinishPicking(_picker:PHPickerViewController,results:NSArray<PHPickerResult>){this.receive?.(results);}
}
/** System photo picker grants access only to the selected image; no library permission. */
export function scanPhoto(options:ScanCodeOptions,registerCancel:(fn:()=>void)=>void):Promise<ScannedCode|null>{
 return new Promise((resolve,reject)=>{
  let done=false,controller:PHPickerViewController|null=null,delegate:PhotoDelegate|null=null;
  const finish=(value:ScannedCode|null,error?:unknown)=>Utils.executeOnMainThread(()=>{
   if(done)return;done=true;if(delegate)delegate.receive=null;
   const settle=()=>{delegate=null;error?reject(error):resolve(value);};
   if(controller?.presentingViewController)controller.dismissViewControllerAnimatedCompletion(true,settle);else settle();
  });
  registerCancel(()=>finish(null));
  Utils.executeOnMainThread(()=>{
   if(done)return;
   try{
    const config=PHPickerConfiguration.new();config.selectionLimit=1;config.filter=PHPickerFilter.imagesFilter;
    controller=PHPickerViewController.alloc().initWithConfiguration(config);controller.modalPresentationStyle=UIModalPresentationStyle.FullScreen;
    delegate=PhotoDelegate.new() as PhotoDelegate;controller.delegate=delegate;
    delegate.receive=results=>{
     if(!results.count){finish(null);return;}
     results.objectAtIndex(0).itemProvider.loadFileRepresentationForTypeIdentifierCompletionHandler('public.image',(url:NSURL,error:NSError)=>{
      if(done)return;
      try{
       if(error||!url)throw Error('Unable to read QR image');
       // Decode while the provider's temporary file is valid, without retaining it.
       let image=CIImage.imageWithContentsOfURL(url);if(!image)throw Error('Unable to read QR image');
       const {width,height}=image.extent.size;
       if(!width||!height||width*height>64_000_000)throw Error('QR image is too large');
       const scale=Math.min(1,4096/Math.max(width,height));if(scale<1)image=image.imageByApplyingTransform(CGAffineTransformMakeScale(scale,scale));
       const detector=CIDetector.detectorOfTypeContextOptions(CIDetectorTypeQRCode,null,{[CIDetectorAccuracy]:CIDetectorAccuracyHigh} as any);
       const features=detector.featuresInImage(image),texts:string[]=[];
       for(let i=0;i<features.count;i++){const text=features.objectAtIndex(i).messageString;if(text)texts.push(String(text));}
       finish(scanImageTexts(texts,options));
      }catch(e){finish(null,e);}
     });
    };
    let host=Application.ios.rootController;while(host?.presentedViewController)host=host.presentedViewController;if(!host)throw Error('No foreground view');
    host.presentViewControllerAnimatedCompletion(controller,true,()=>{});
   }catch(e){finish(null,e);}
  });
 });
}
