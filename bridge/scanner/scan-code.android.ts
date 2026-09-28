import {Application} from '@nativescript/core';
import {scanText,scanLimit,type ScanCodeOptions,type ScannedCode} from './types';
export type {ScanCodeOptions,ScannedCode} from './types';
declare const com:any;
let cancel:(()=>void)|null=null;
export function cancelScan(){cancel?.();}
/** ZXing Embedded runs an offline camera Activity and requests camera permission
 * only when opened. The Activity owns pause/resume, autofocus and back dismissal. */
export async function scanCode(options:ScanCodeOptions={}):Promise<ScannedCode|null>{
 scanLimit(options);
 if(cancel)throw Error('Scanner already open');
 const activity=Application.android.foregroundActivity??Application.android.startActivity;
 if(!activity)throw Error('No foreground activity');
 const request=0x6a71;
 return new Promise((resolve,reject)=>{
  let finished=false;
  const finish=(value:ScannedCode|null,error?:unknown)=>{if(finished)return;finished=true;Application.android.off(Application.android.activityResultEvent,result);cancel=null;error?reject(error):resolve(value);};
  const result=(args:any)=>{if(args.requestCode!==request)return;try{if(args.intent?.getBooleanExtra('MISSING_CAMERA_PERMISSION',false))throw Error('Camera permission denied');const decoded=com.google.zxing.integration.android.IntentIntegrator.parseActivityResult(args.resultCode,args.intent);const text=decoded?.getContents();finish(text==null?null:scanText(String(text),options));}catch(e){finish(null,e);}};
  cancel=()=>{activity.finishActivity(request);finish(null);};
  Application.android.on(Application.android.activityResultEvent,result);
  try {const scanner=new com.google.zxing.integration.android.IntentIntegrator(activity);scanner.setRequestCode(request);const formats=new java.util.ArrayList<string>();formats.add('QR_CODE');scanner.setDesiredBarcodeFormats(formats);scanner.setPrompt(options.prompt??'Scan a QR code');scanner.setBeepEnabled(false);scanner.setBarcodeImageEnabled(false);scanner.setOrientationLocked(false);scanner.initiateScan();}
  catch(e){finish(null,e);}
 });
}
