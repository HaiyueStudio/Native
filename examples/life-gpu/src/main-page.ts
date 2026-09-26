import {Application,EventData,Page,Label,knownFolders,File,path,Screen,isAndroid} from '@nativescript/core';
import {Canvas} from '@nativescript/canvas';
import {captureSurfaceFrame} from '../../../bridge/render/frame-capture';
import {NativeSurface} from '../../../bridge/render/surface';
// Shared JS fixture intentionally uses public Engine package exports.
// @ts-ignore isolated benchmark module is also used directly by browsers.
import {EngineLife} from '../../../../RustNative/comparison-life/core.js';
let life:any=null,surface:NativeSurface|null=null,raf=0,started=false,suspended=false;
export function onCanvasReady(args:EventData){const canvas=args.object as Canvas;if(started)return;started=true;const label=(canvas.page as Page).getViewById<Label>('status');let adapter:unknown;let captured=false;
  surface=new NativeSurface(canvas,(event,detail)=>{if(event==='adapter')adapter=detail;});
  const output=path.join(knownFolders.documents().path,'engine-life.json');
  const onStatus=(s:any)=>{s.adapter=adapter;if(s.state==='complete'&&life)life.lastHud=0;label.text=`${s.state} ${s.cases.length}/12 ${s.error??''}`;File.fromPath(output).writeTextSync(JSON.stringify(s));if(isAndroid){const dir=Application.android.context.getExternalFilesDir(null!).getAbsolutePath();File.fromPath(path.join(dir,'engine-life.json')).writeTextSync(JSON.stringify(s));}console.log('ENGINE_LIFE '+s.state+' '+s.cases.length);};
  const begin=async()=>{if(!surface!.hasLayout){setTimeout(()=>void begin(),100);return;}
    life=new EngineLife({...surface!.engineOptions(),devicePixelRatio:Screen.mainScreen.scale},{name:isAndroid?'android':'iphone',present:()=>{if(!isAndroid&&life?.state==='complete'&&!captured){captured=true;try{captureSurfaceFrame(canvas,'engine-life.png');}catch(e){console.log('Capture failed '+e);}}surface!.present();},onStatus});
    const tick=()=>{if(!suspended&&life){try{life.tick();}catch(e){life.fail(e);}if(!['failed','aborted','complete'].includes(life.state))raf=requestAnimationFrame(tick);}};
    raf=requestAnimationFrame(tick);try{await life.init();life.host.adapter=adapter;life.start();}catch(e){life.fail(e);}
  };void begin();
}
export function onLoaded(){}
export function onUnloaded(){cancelAnimationFrame(raf);life?.interrupt('unloaded');life?.destroy();surface?.release();life=null;started=false;}
Application.on(Application.suspendEvent,()=>{suspended=true;life?.interrupt('background');cancelAnimationFrame(raf);});
