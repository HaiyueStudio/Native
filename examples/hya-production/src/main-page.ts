import {Application,Device,File,knownFolders,path,Page,Label,Screen,type EventData} from '@nativescript/core';
import type {Canvas} from '@nativescript/canvas';
import {Entity,type HaiyueEngine} from '@haiyue/engine';
import {GuiRoot,GuiButton,GuiLabel,type GuiSystem} from '@haiyue/engine/gui';
import {createHyaPlayer,type HyaPlayer,type HyaFrameRequest} from '@haiyue/extensions/hya-player';
import type {HyaSemanticHost,HyaSemanticSnapshot} from '@haiyue/extensions/hya-data';
import {NativeRenderHost} from '../../../bridge/lifecycle/host';
import type {NativeCanvasInput} from '../../../bridge/render/surface';
import {NativeTouchInput} from '../../../bridge/input/native-touch.ios';
import {NativeGuiTextInputHost} from '../../../bridge/input/text-input.ios';
import {NativeCanvasTextures} from '../../../bridge/render/canvas-textures.ios';
import {createIosHyaImageHost} from './ios-image-host';
import {createIosHyaAudioHost,type IosHyaAudioController} from './ios-audio-host';
import {prepareIosByteCapabilities} from './ios-byte-capabilities';
import {loadSceneResources} from './scene-resources';
import {probeIosNativePcm} from './ios-pcm-probe';

let host:NativeRenderHost|null=null,activeCanvas:Canvas|null=null;
const ready=new WeakSet<Canvas>();
export function onCanvasReady(args:EventData):void {const canvas=args.object as Canvas;ready.add(canvas);start(canvas);}
export function onLoaded(args:EventData):void {const canvas=(args.object as Page).getViewById<Canvas>('surface');if(canvas&&ready.has(canvas))start(canvas);}
export function onUnloaded():void {if(!Application.inBackground&&!Application.suspended)dispose();}

function start(canvas:Canvas):void {
  if(host&&activeCanvas!==canvas)dispose();if(host)return;activeCanvas=canvas;
  let player:HyaPlayer|null=null,audio:IosHyaAudioController|null=null,gui:GuiSystem|null=null,root:GuiRoot|null=null,engine:HaiyueEngine|null=null;
  let textures:NativeCanvasTextures|null=null,assets:Awaited<ReturnType<typeof loadSceneResources>>|null=null,releaseBytes:(()=>void)|null=null;
  let offInvalidation:(()=>void)|null=null,disposed=false,preparing=false,pendingJobs=0,sequence=0,pending:HyaFrameRequest|null=null,first=true,resumePlayback=false;
  let semanticSnapshot:HyaSemanticSnapshot|null=null,semanticAction:Parameters<HyaSemanticHost['subscribeActions']>[0]|null=null;
  const abort=new AbortController(),journal:string[]=[],log=File.fromPath(path.join(knownFolders.documents().path,'g11-hya-scene.jsonl'));
  const status=(text:string)=>{const label=(canvas.page as Page).getViewById<Label>('status');if(label)label.text=text;};
  const record=(event:string,detail:unknown)=>{
    const row=JSON.stringify({time:new Date().toISOString(),event,detail});console.log('[G11] '+row);journal.push(row);
    if(journal.length>2000)journal.splice(1,1);log.writeTextSync(journal.join('\n')+'\n');
  };
  const bridge=new NativeGuiTextInputHost(canvas.nativeViewProtected as UIView,record);
  const touch=new NativeTouchInput(canvas,()=>host?.requestFrame());
  const input:NativeCanvasInput={addEventListener:touch.target.addEventListener.bind(touch.target),removeEventListener:touch.target.removeEventListener.bind(touch.target),setPointerCapture:touch.target.setPointerCapture.bind(touch.target),releasePointerCapture:touch.target.releasePointerCapture.bind(touch.target)} as unknown as NativeCanvasInput;
  const alive=()=>{if(disposed||abort.signal.aborted)throw new Error('Native scene preparation cancelled.');};
  const snapshot=()=>({status:player?.status??null,frame:player?.lastFrame?.sequence??null,time:player?.lastFrame?.time??null,data:player?.data?.read('root',['label'])??null,semantics:semanticSnapshot,resources:assets?.snapshot()??null,text:bridge.snapshot(),touch:touch.snapshot(),rendering:host?.renderingSnapshot()??null,audioFault:audio?.fault?String(audio.fault):null});
  const semantics:HyaSemanticHost={update(value){semanticSnapshot=value;},subscribeActions(listener){if(semanticAction)throw new Error('Scene already owns a semantic subscription.');semanticAction=listener;return{unsubscribe(){if(semanticAction===listener)semanticAction=null;}};}};
  const action=(name:string,run:()=>void|Promise<void>)=>{
    try {alive();const result=run();if(result)void result.then(()=>{if(!disposed){record(name,snapshot());host?.requestFrame();}},error=>{if(!disposed){record('action-error',{name,error:String(error)});status(String(error));}});else{record(name,snapshot());host?.requestFrame();}}
    catch(error){record('action-error',{name,error:String(error)});status(String(error));}
  };
  const update=(event:{detail:{delta:number}})=>{
    if(disposed||!player||!engine)return;
    try{
      const dpr=Math.min(Screen.mainScreen.scale,2);
      pending??={sequence:++sequence,deltaSeconds:first?0:event.detail.delta/1000,viewport:[engine.width/dpr,engine.height/dpr],dpr};first=false;
      const frame=player.advance(pending);
      if(frame.ready){pending=null;if(frame.sequence===1||frame.events.length||frame.diagnostics.length)record('frame',{sequence:frame.sequence,time:frame.time,events:frame.events,diagnostics:frame.diagnostics});}
      audio?.poll();if(audio?.fault)throw audio.fault;
    }catch(error){host?.fail(error);}
  };
  const finishCleanup=()=>{
    if(preparing||pendingJobs>0)return;
    const errors:unknown[]=[],release=(run:()=>void)=>{try{run();}catch(error){errors.push(String(error));}};
    release(()=>audio?.dispose());audio=null;release(()=>textures?.dispose());textures=null;
    const resources=assets?.snapshot();assets?.dispose();assets=null;release(()=>releaseBytes?.());releaseBytes=null;
    record('scene-cleanup',{resources,text:bridge.snapshot(),touch:touch.snapshot(),semanticSubscription:semanticAction!==null,errors});
    if(errors.length)throw new AggregateError(errors,'Native scene cleanup failed.');
  };
  host=new NativeRenderHost(canvas,status,{
    diagnosticName:'g11',enginePackageVersion:'0.2.2 private G11 review candidate; see qualified-candidate.json',canvasInput:input,diagnosticIntervalFrames:0,
    engineOptions:{clearColor:{r:240/255,g:240/255,b:240/255,a:1}},
    needsAnimationFrame:()=>!disposed&&(pending!==null||player?.status==='running'||gui?.animating===true),
    async prepareScene(value){
      engine=value;preparing=true;
      try{
        releaseBytes=await prepareIosByteCapabilities();alive();
        assets=await loadSceneResources(record);alive();
        const candidate=JSON.parse(File.fromPath(path.join(knownFolders.currentApp().path,'qualified-candidate.json')).readTextSync());
        record('candidate',candidate);audio=createIosHyaAudioHost({resolve:assets.resolve});textures=new NativeCanvasTextures(engine.device);
        const scene=engine.createScene({name:'G11 real HYA Native scene',render3D:false,render2D:false,gui:{loadOp:'clear',textInputHost:bridge,font:{canvasFactory:textures.createCanvas2D,readAtlasPixels:textures.readAtlasPixels,fontFamily:'sans-serif',chars:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 你好世界中文/():;,.?!-_|'}}});
        gui=scene.guiSystem!;root=new GuiRoot({theme:{fontSize:14}});scene.add(new Entity('g11-native-gui').addComponent(root));
        const dpr=Math.min(Screen.mainScreen.scale,2),source=assets.source as {parts:readonly {extension:string}[]};
        const prepared=await createHyaPlayer(source,{mode:'render',scene,gui,root,viewport:[engine.width/dpr,engine.height/dpr],dpr,signal:abort.signal,host:{resources:assets.resources,images:createIosHyaImageHost(),audio:audio.host,semantics,capabilities:new Set(source.parts.map(part=>part.extension)),invalidate:()=>host?.requestFrame(),diagnostic:detail=>record('diagnostic',detail),events:events=>record('events',events)}});
        if(disposed||abort.signal.aborted){prepared.dispose();alive();}
        player=prepared;engine.switchScene(scene);
        root.add(new GuiLabel({x:'2%',y:4,width:'96%',height:25,text:'G11: real CJK / PNG / N-slice / G06 / PCM',fontSize:13}));
        const button=(text:string,column:number,row:number,run:()=>void|Promise<void>)=>root!.add(new GuiButton({x:`${column*25+1}%`,y:`${76+row*8}%`,width:'23%',height:38,text,focus:{mode:'none'},onClick:()=>action(text,run)}));
        button('Unlock',0,0,()=>player!.unlockAudio());
        button('Activate',1,0,()=>{if(!semanticAction)throw new Error('Semantic action route is not ready.');semanticAction('activate','tap');});
        button('Pause / Run',2,0,()=>{if(player!.status==='paused')player!.resume();else player!.pause();});
        button('Seek 0',3,0,()=>{player!.seek(0);});
        let fast=false;button('Rate .5 / 2',0,1,()=>{player!.setRate(fast ? .5 : 2);fast=!fast;});
        button('Replace PNG',1,1,async()=>{await player!.data!.replaceResource('picture.alias','image','alternate');});
        button('Save',2,1,()=>record('human-checkpoint',snapshot()));
        button('End',3,1,()=>{record('human-end',snapshot());setTimeout(()=>{if(disposed)return;dispose();status('G11 closed. Export g11-hya-scene.jsonl and g11-host.jsonl.');},0);});
        let probing=false;
        root.add(new GuiButton({x:'1%',y:'92%',width:'98%',height:'6%',text:'Native PCM probe (seven actual offline cases)',focus:{mode:'none'},onClick:()=>action('pcm-probe',async()=>{
          if(probing)throw new Error('Native PCM probe is already running.');probing=true;++pendingJobs;
          const resume=player?.status==='running';
          try{player?.pause();audio?.suspend();const result=await probeIosNativePcm(record,abort.signal);if(!disposed)status(result.status);}
          finally{probing=false;--pendingJobs;if(disposed)finishCleanup();else if(resume){player?.resume();host?.requestFrame();}}
        })}));
        offInvalidation=root.onInvalidation(()=>host?.requestFrame());engine.on('update',update);
        record('environment',{model:Device.model,os:Device.os,osVersion:Device.osVersion,canvas:'2.1.18',runtime:'9.0.3',qualification:'Candidate only. Native build, PCM probe, pixels, accessibility and human acceptance remain required.'});
        return {log:log.path,parts:source.parts.length,publicPackages:candidate.packages};
      }finally{preparing=false;if(disposed)finishCleanup();}
    },
    bindInput:()=>({
      suspend(){bridge.suspend();touch.suspend();if(player?.status==='running'){resumePlayback=true;player.pause();}audio?.suspend();gui?.stopAnimations();record('input-suspended',snapshot());},
      resume(){bridge.resume();touch.resume();if(resumePlayback){resumePlayback=false;player?.resume();}first=true;record('input-resumed',{...snapshot(),audio:'A new real Unlock gesture is required.'});},
      snapshot,
      dispose(){bridge.dispose();touch.dispose();},
    }),
    disposeScene(){
      if(disposed)return;disposed=true;abort.abort();offInvalidation?.();offInvalidation=null;engine?.off('update',update);
      try{player?.dispose();}finally{player=null;bridge.dispose();touch.dispose();gui=null;root=null;finishCleanup();}
    },
  });
  Application.on(Application.exitEvent,dispose);
}
function dispose():void {Application.off(Application.exitEvent,dispose);const current=host;host=null;activeCanvas=null;current?.dispose();}
