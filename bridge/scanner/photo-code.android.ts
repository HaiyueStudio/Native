import {Application} from '@nativescript/core';
import {scanImageTexts,type ScanCodeOptions,type ScannedCode} from './types';
declare const com:any;
let nextRequest=0x5a70;
/** Android's document/photo provider grants a temporary URI, without storage permission. */
export function scanPhoto(options:ScanCodeOptions,registerCancel:(fn:()=>void)=>void):Promise<ScannedCode|null>{
 const activity=Application.android.foregroundActivity??Application.android.startActivity;
 if(!activity)return Promise.reject(Error('No foreground activity'));
 const request=nextRequest=nextRequest>=0x5fff?0x5a71:nextRequest+1;
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=(value:ScannedCode|null,error?:unknown)=>{if(done)return;done=true;Application.android.off(Application.android.activityResultEvent,result);error?reject(error):resolve(value);};
  const result=(args:any)=>{
   if(args.requestCode!==request||done)return;
   if(args.resultCode!==android.app.Activity.RESULT_OK){finish(null);return;}
   let bitmap:android.graphics.Bitmap|null=null;
   try{
    const uri=args.intent?.getData();if(!uri)throw Error('Unable to read QR image');
    const resolver=activity.getContentResolver(),settings=new android.graphics.BitmapFactory.Options();settings.inJustDecodeBounds=true;
    const read=()=>{const stream=resolver.openInputStream(uri);try{return android.graphics.BitmapFactory.decodeStream(stream,null as any,settings);}finally{stream?.close();}};
    read();const w=settings.outWidth,h=settings.outHeight;if(w<=0||h<=0)throw Error('Unable to read QR image');
    if(w*h>64_000_000)throw Error('QR image is too large');
    settings.inSampleSize=1;while(Math.max(w,h)/settings.inSampleSize>2048)settings.inSampleSize*=2;
    settings.inJustDecodeBounds=false;bitmap=read();if(!bitmap)throw Error('Unable to read QR image');
    const width=bitmap.getWidth(),height=bitmap.getHeight(),pixels=Array.create('int',width*height);
    bitmap.getPixels(pixels,0,width,0,0,width,height);
    const z=com.google.zxing,source=new z.RGBLuminanceSource(width,height,pixels),binary=new z.BinaryBitmap(new z.common.HybridBinarizer(source));
    const hints=new java.util.HashMap();hints.put(z.DecodeHintType.TRY_HARDER,java.lang.Boolean.TRUE);
    let codes:any;try{codes=new z.multi.qrcode.QRCodeMultiReader().decodeMultiple(binary,hints);}catch{throw Error('No QR code in image');}
    const texts:string[]=[];for(let i=0;i<codes.length;i++)texts.push(String(codes[i].getText()));finish(scanImageTexts(texts,options));
   }catch(e){finish(null,e);}finally{bitmap?.recycle();}
  };
  registerCancel(()=>{try{activity.finishActivity(request);}finally{finish(null);}});
  Application.android.on(Application.android.activityResultEvent,result);
  try{const intent=new android.content.Intent(android.content.Intent.ACTION_GET_CONTENT);intent.setType('image/*');intent.addCategory(android.content.Intent.CATEGORY_OPENABLE);activity.startActivityForResult(intent,request);}catch(e){finish(null,e);}
 });
}
