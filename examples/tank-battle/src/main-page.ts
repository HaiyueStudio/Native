import { Application, File, knownFolders, path, type EventData } from '@nativescript/core';
import { Canvas } from '@nativescript/canvas';
import { NativeEngineLaunchPage } from '../../../bridge/branding/launch-page';
import { NativeRenderHost } from '../../../bridge/lifecycle/host';
import { NativeTouchInput } from '../../../bridge/input/native-touch';
import { NativeCanvasTextures } from '../../../bridge/render/canvas-textures';
import type { NativeCanvasInput } from '../../../bridge/render/surface';
import { readNativeBytes } from '../../../bridge/files/read-bytes';
import { NativeSettingsStorage } from '../../../bridge/storage/settings-storage';
import { MobileTankGame } from '../../../games/tank-battle/MobileTankGame';
import { NativePcmAudioBank } from '../../../bridge/audio/pcm-bank';

export function createLaunchPage(): NativeEngineLaunchPage {
  const page = new NativeEngineLaunchPage({ orientation: 'portrait', message: '正在准备铁甲前线' });
  const canvas = new Canvas(); canvas.id='surface'; canvas.ignoreTouchEvents=true;
  page.gameRoot.addChild(canvas);
  let host:NativeRenderHost|null=null, game:MobileTankGame|null=null, input:NativeTouchInput|null=null;
  let textures:NativeCanvasTextures|null=null, detach=()=>{};
  let audio:NativePcmAudioBank|null=null;
  const images:GPUTexture[]=[];
  const storage=new NativeSettingsStorage('tank-battle:');
  const dispose=()=>{host?.dispose();host=null;page.splash.dispose();Application.off(Application.exitEvent,dispose);Application.off(Application.uncaughtErrorEvent,failed);};
  const failed=(event:{error?:unknown})=>host?.fail(event.error);
  const ready=(_event:EventData)=>{
    if(host)return;
    input=new NativeTouchInput(canvas,()=>{}, {pointerMode:'all'});
    const target=input.target;
    host=new NativeRenderHost(canvas,text=>{
      if(text.startsWith('原生 WebGPU 已呈现'))page.splash.presented();
      else if(text.startsWith('正在初始化'))page.splash.setMessage('正在准备铁甲前线');
      else page.splash.fail(text);
    },{
      diagnosticName:'tank-battle',engineOptions:{msaaSamples:4,clearColor:{r:.06,g:.09,b:.055,a:1}},
      canvasInput:{addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target),
        setPointerCapture:(id:number)=>{if(target.hasActivePointer(id))target.setPointerCapture(id);},releasePointerCapture:target.releasePointerCapture.bind(target)} as unknown as NativeCanvasInput,
      prepareScene(engine){
        textures=new NativeCanvasTextures(engine.device);
        const directory=path.join(knownFolders.currentApp().path,'game-assets');
        audio=new NativePcmAudioBank(Object.entries({shoot:.055,hit:.05,explode:.23,pickup:.19,over:.65,clear:.4}).map(([id,seconds])=>({id,seconds,path:path.join(directory,id+'.wav')})),()=>game?.pause());
        const load=(name:string)=>{
          const meta=JSON.parse(File.fromPath(path.join(directory,name+'.json')).readTextSync());
          const bytes=new Uint8Array(readNativeBytes(path.join(directory,name+'.rgba')));
          if(bytes.length!==meta.width*meta.height*4)throw new Error(`Invalid texture ${name}`);
          const texture=engine.device.createTexture({label:name,size:[meta.width,meta.height],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
          images.push(texture);engine.device.queue.writeTexture({texture},bytes,{bytesPerRow:meta.width*4},[meta.width,meta.height]);return texture;
        };
        game=new MobileTankGame(engine,load('mobile-atlas'),load('controls'),{
          read:()=>JSON.parse(storage.getItem('save-v1')??'null'),write:state=>storage.setItem('save-v1',JSON.stringify(state)),
        },{canvasFactory:textures.createCanvas2D,readAtlasPixels:textures.readAtlasPixels},{unlock:()=>audio?.unlock(),play:id=>{audio?.play(id,{channel:id,loop:false,gain:.8,pan:0,priority:id==='shoot'?1:2});},stop:()=>audio?.suspend()});
        const update=({detail:{time,delta}}:{detail:{time:number;delta:number}})=>game?.update(time,delta);
        engine.on('update',update);detach=()=>engine.off('update',update);
        return {mode:1,renderer:'engine-gui',textures:images.length};
      },
      bindInput(){return {suspend(){game?.pause();input?.suspend();},resume(){input?.resume();},dispose(){input?.dispose();},snapshot(){return {input:input?.snapshot(),game:game?.snapshot()};}};},
      disposeScene(){detach();game?.dispose();game=null;audio?.dispose();audio=null;input?.dispose();input=null;textures?.dispose();for(const image of images)image.destroy();images.length=0;},
    });
    Application.on(Application.exitEvent,dispose);Application.on(Application.uncaughtErrorEvent,failed);
  };
  canvas.on('ready',ready);
  page.on('unloaded',()=>{if(!Application.inBackground&&!Application.suspended)dispose();});
  return page;
}
