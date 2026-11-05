import {Application,Device,File,knownFolders,path,Page,Label,Screen,type EventData,type View} from '@nativescript/core';
import type {Canvas} from '@nativescript/canvas';
import {Entity,type HaiyueEngine} from '@haiyue/engine';
import {getSceneRenderPipeline} from '@haiyue/engine/experimental';
import {beginRenderCommandPass,type RenderCommandContext} from '@haiyue/engine/extension-authoring';
import {GuiRoot,GuiButton,GuiLabel,type GuiSystem} from '@haiyue/engine/gui';
import {createHyaPlayer,type HyaPlayer,type HyaFrameRequest} from '@haiyue/extensions/hya-player';
import type {HyaSemanticHost,HyaSemanticSnapshot} from '@haiyue/extensions/hya-data';
import {NativeRenderHost} from '../../../bridge/lifecycle/host';
import {captureNativeView} from '../../../bridge/render/view-capture.ios';
import type {NativeCanvasInput} from '../../../bridge/render/surface';
import {NativeTouchInput} from '../../../bridge/input/native-touch.ios';
import {NativeGuiTextInputHost} from '../../../bridge/input/text-input.ios';
import {NativeCanvasTextures} from '../../../bridge/render/canvas-textures.ios';
import {createIosHyaImageHost} from './ios-image-host';
import {createIosHyaAudioHost,type IosHyaAudioController} from './ios-audio-host';
import {prepareIosByteCapabilities} from './ios-byte-capabilities';
import {loadSceneResources} from './scene-resources';
import {probeIosNativePcm} from './ios-pcm-probe';
import {createIosHyaSemanticsHost} from './ios-semantics-host';
import {prepareFirstHyaFrame} from './prepare-first-frame';
import {NativePlaybackUnlock} from './playback-unlock';
import {createTextEditingControls} from './text-editing-controls';

let host:NativeRenderHost|null=null,activeCanvas:Canvas|null=null;
const ready=new WeakSet<Canvas>();
let dismissTextInput:((cancel?:boolean)=>void)|null=null;
export function onDoneInput():void {dismissTextInput?.();}
export function onCancelInput():void {dismissTextInput?.(true);}
export function onCanvasReady(args:EventData):void {const canvas=args.object as Canvas;ready.add(canvas);start(canvas);}
export function onLoaded(args:EventData):void {const canvas=(args.object as Page).getViewById<Canvas>('surface');if(canvas&&ready.has(canvas))start(canvas);}
export function onUnloaded():void {if(!Application.inBackground&&!Application.suspended)dispose();}

function start(canvas:Canvas):void {
  if(host&&activeCanvas!==canvas)dispose();if(host)return;activeCanvas=canvas;
  let player:HyaPlayer|null=null,audio:IosHyaAudioController|null=null,gui:GuiSystem|null=null,root:GuiRoot|null=null,engine:HaiyueEngine|null=null;
  let textures:NativeCanvasTextures|null=null,assets:Awaited<ReturnType<typeof loadSceneResources>>|null=null,releaseBytes:(()=>void)|null=null;
  let images:ReturnType<typeof createIosHyaImageHost>|null=null;
  let semanticProjection:ReturnType<typeof createIosHyaSemanticsHost>|null=null;
  let offInvalidation:(()=>void)|null=null,disposed=false,preparing=false,pendingJobs=0,sequence=0,pending:HyaFrameRequest|null=null,first=true,probing=false;
  const playbackUnlock=new NativePlaybackUnlock();
  let semanticSnapshot:HyaSemanticSnapshot|null=null,semanticAction:Parameters<HyaSemanticHost['subscribeActions']>[0]|null=null;
  const abort=new AbortController(),journal:string[]=[],log=File.fromPath(path.join(knownFolders.documents().path,'g11-hya-scene.jsonl'));
  const status=(text:string)=>{const label=(canvas.page as Page).getViewById<Label>('status');if(label)label.text=text;};
  const record=(event:string,detail:unknown)=>{
    if(event==='text-session-opened'||event==='text-session-closed'){
      const page=canvas.page as Page,toolbar=page.getViewById<View>('textToolbar');
      if(toolbar)toolbar.visibility=event==='text-session-opened'?'visible':'collapse';
      if(event==='text-session-opened'&&NSProcessInfo.processInfo.environment.objectForKey('G13_INPUT_DIAGNOSTIC')==='1')setTimeout(()=>{
        if(disposed)return;
        const inspect=(id:string)=>{const item=page.getViewById<View>(id),native=item?.nativeViewProtected as UIView|undefined,window=native?.window;
          const rect=native&&window?native.convertRectToView(native.bounds,window):null;
          const hit=rect&&window?window.hitTestWithEvent(CGPointMake(rect.origin.x+rect.size.width/2,rect.origin.y+rect.size.height/2),null!):null;
          return {id,found:!!item,visibility:item?.visibility,loaded:item?.isLoaded,hidden:native?.hidden,alpha:native?.alpha,rect:rect?{x:rect.origin.x,y:rect.origin.y,width:rect.size.width,height:rect.size.height}:null,hit:hit?String(hit.class()):null,hitInside:!!(hit&&native&&(hit===native||hit.isDescendantOfView(native)))};};
        record('text-toolbar-layout',{views:['textToolbar','cancelInput','doneInput'].map(inspect)});
        try{captureNativeView(page,'g13-text-toolbar.png');record('text-toolbar-capture',{file:'g13-text-toolbar.png'});}catch(error){record('text-toolbar-capture-error',{error:String(error)});}
      },300);
    }
    const row=JSON.stringify({time:new Date().toISOString(),event,detail});console.log('[G11] '+row);journal.push(row);
    if(journal.length>2000)journal.splice(1,1);
    try{log.writeTextSync(journal.join('\n')+'\n');}catch(error){console.error('G11 diagnostic journal could not be persisted',error);}
  };
  const bridge=new NativeGuiTextInputHost(canvas.nativeViewProtected as UIView,record);
  const editing=createTextEditingControls(bridge,()=>gui,()=>host?.requestFrame());
  dismissTextInput=cancel=>action(cancel?'text-cancel':'text-done',()=>editing.dismiss(cancel));
  const touch=new NativeTouchInput(canvas,()=>host?.requestFrame());
  const input:NativeCanvasInput={addEventListener:touch.target.addEventListener.bind(touch.target),removeEventListener:touch.target.removeEventListener.bind(touch.target),setPointerCapture:touch.target.setPointerCapture.bind(touch.target),releasePointerCapture:touch.target.releasePointerCapture.bind(touch.target)} as unknown as NativeCanvasInput;
  const alive=()=>{if(disposed||abort.signal.aborted)throw new Error('Native scene preparation cancelled.');};
  const snapshot=()=>({status:player?.status??null,frame:player?.lastFrame?.sequence??null,time:player?.lastFrame?.time??null,data:player?.data?.read('root',['label'])??null,semantics:semanticSnapshot,nativeSemantics:semanticProjection?.snapshot()??null,resources:assets?.snapshot()??null,text:bridge.snapshot(),touch:touch.snapshot(),rendering:host?.renderingSnapshot()??null,audio:audio&&!audio.fault?{state:audio.host.state,sampleFrame:audio.host.nowFrame(),sampleRate:audio.host.sampleRate}:null,audioFault:audio?.fault?String(audio.fault):null});
  const semantics:HyaSemanticHost={update(value){if(!semanticProjection)throw new Error('Native semantic projection is not prepared.');semanticProjection.host.update(value);semanticSnapshot=value;},subscribeActions(listener){if(semanticAction||!semanticProjection)throw new Error('Scene semantic subscription is unavailable.');const lease=semanticProjection.host.subscribeActions(listener);semanticAction=listener;return{unsubscribe(){lease.unsubscribe();if(semanticAction===listener)semanticAction=null;}};}};
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
    release(()=>images?.dispose());images=null;
    const resources=assets?.snapshot();assets?.dispose();assets=null;release(()=>releaseBytes?.());releaseBytes=null;
    record('scene-cleanup',{resources,text:bridge.snapshot(),touch:touch.snapshot(),semanticSubscription:semanticAction!==null,errors});
    // Preserve cleanup failures in evidence while allowing NativeRenderHost to retire its engine/surface too.
    if(errors.length)console.error('Native scene cleanup failed',errors);
  };
  host=new NativeRenderHost(canvas,status,{
    diagnosticName:'g11',enginePackageVersion:'0.2.2 G13 public-package candidate; see qualified-candidate.json',canvasInput:input,diagnosticIntervalFrames:0,
    engineOptions:{clearColor:{r:240/255,g:240/255,b:240/255,a:1}},
    needsAnimationFrame:()=>!disposed&&(pending!==null||player?.status==='running'||gui?.animating===true),
    async prepareScene(value){
      engine=value;preparing=true;
      try{
        releaseBytes=await prepareIosByteCapabilities();alive();
        assets=await loadSceneResources(record);alive();
        const candidate=JSON.parse(File.fromPath(path.join(knownFolders.currentApp().path,'qualified-candidate.json')).readTextSync());
        record('candidate',candidate);audio=createIosHyaAudioHost({resolve:assets.resolve});textures=new NativeCanvasTextures(engine.device);
        semanticProjection=createIosHyaSemanticsHost(canvas.nativeViewProtected as UIView,{record,requestFrame:()=>host?.requestFrame(),beforeAction(_id,nativeAction,invoke){
          if(nativeAction!=='tap'){invoke();return;}
          const current=player;if(!current||disposed)return;
          // Enter the native audio unlock synchronously in the real UIKit/VoiceOver action.
          void playbackUnlock.unlock(current).then(()=>{if(!disposed&&player===current)invoke();},error=>{try{record('native-semantic-unlock-error',{error:String(error)});}catch(failure){console.error(failure);}});
        }});
        const scene=engine.createScene({name:'G11 real HYA Native scene',render3D:false,render2D:false,view:{clearColor:{r:240/255,g:240/255,b:240/255,a:1}},gui:{loadOp:'load',textInputHost:editing.host,font:{canvasFactory:textures.createCanvas2D,readAtlasPixels:textures.readAtlasPixels,fontFamily:'sans-serif',chars:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 你好世界中文/():;,.?!-_|'}}});
        getSceneRenderPipeline(scene).add({record(_world:unknown,context:RenderCommandContext){const {passEncoder,ownsPass}=beginRenderCommandPass(context);if(ownsPass)passEncoder.end();}},{order:-1,pass:'isolated',loadOp:'clear',depth:false});
        gui=scene.guiSystem!;root=new GuiRoot({theme:{fontSize:14}});scene.add(new Entity('g11-native-gui').addComponent(root));
        const dpr=Math.min(Screen.mainScreen.scale,2),source=assets.source as {parts:readonly {extension:string}[]};
        images=createIosHyaImageHost(engine.device.queue);
        const prepared=await createHyaPlayer(source,{mode:'render',scene,gui,root,viewport:[engine.width/dpr,engine.height/dpr],dpr,signal:abort.signal,host:{resources:assets.resources,images,audio:audio.host,semantics,capabilities:new Set(source.parts.map(part=>part.extension)),invalidate:()=>host?.requestFrame(),diagnostic:detail=>record('diagnostic',detail),events:events=>record('events',events)}});
        if(disposed||abort.signal.aborted){prepared.dispose();alive();}
        player=prepared;
        const initial=await prepareFirstHyaFrame(player,{sequence:++sequence,deltaSeconds:0,viewport:[engine.width/dpr,engine.height/dpr],dpr},abort.signal);alive();
        record('initial-draw-frame-prepared',{sequence:initial.sequence,time:initial.time,ready:initial.ready});
        engine.switchScene(scene);
        root.add(new GuiLabel({x:'2%',y:4,width:'96%',height:25,text:'G11: real CJK / PNG / N-slice / G06 / PCM',fontSize:13}));
        const button=(text:string,column:number,row:number,run:()=>void|Promise<void>)=>root!.add(new GuiButton({x:`${column*25+1}%`,y:`${76+row*8}%`,width:'23%',height:38,text,focus:{mode:'none'},onClick:()=>action(text,run)}));
        button('Unlock',0,0,()=>{if(probing)throw new Error('Wait for the PCM probe to finish.');return playbackUnlock.unlock(player!);});
        button('Activate',1,0,()=>{const target=semanticSnapshot?.nodes.find(node=>node.target==='button.alias'&&node.role==='button');if(!semanticAction||!target)throw new Error('Semantic action route is not ready.');semanticAction(target.id,'tap');});
        button('Pause / Run',2,0,async()=>{if(probing)throw new Error('Wait for the PCM probe to finish.');if(player!.status==='paused'){await playbackUnlock.unlock(player!);if(!disposed&&player?.status==='paused')player.resume();}else player!.pause();});
        button('Seek 0',3,0,()=>{player!.seek(0);});
        let fast=false;button('Rate .5 / 2',0,1,()=>{player!.setRate(fast ? .5 : 2);fast=!fast;});
        button('Replace PNG',1,1,async()=>{await player!.data!.replaceResource('picture.alias','image','alternate');});
        button('Save',2,1,()=>record('human-checkpoint',snapshot()));
        button('End',3,1,()=>{record('human-end',snapshot());setTimeout(()=>{if(disposed)return;dispose();status('G11 closed. Export g11-hya-scene.jsonl and g11-host.jsonl.');},0);});
        const probeButton=new GuiButton({x:'1%',y:'92%',width:'98%',height:'6%',text:'Native PCM probe (7 cases)',focus:{mode:'none'},onClick:()=>action('pcm-probe',async()=>{
          if(probing)throw new Error('Native PCM probe is already running.');probing=true;++pendingJobs;
          try{playbackUnlock.pause(player);audio?.suspend();probeButton.setText('Running PCM…');status('Running seven Native PCM cases…');const result=await probeIosNativePcm(record,abort.signal);if(!disposed){const passed=result.cases.filter(value=>value.passed).length;probeButton.setText(`PCM ${passed}/7 passed · tap Unlock`);status(`PCM: ${passed}/7 passed. Tap Unlock to resume.`);}}
          catch(error){if(!disposed)probeButton.setText('PCM failed · see status');throw error;}
          finally{probing=false;--pendingJobs;if(disposed)finishCleanup();else host?.requestFrame();}
        })});root.add(probeButton);
        offInvalidation=root.onInvalidation(()=>host?.requestFrame());engine.on('update',update);
        record('environment',{model:Device.model,os:Device.os,osVersion:Device.osVersion,canvas:'2.1.18',runtime:'9.0.3',qualification:'Candidate only. Native build, PCM probe, pixels, VoiceOver editing/announcements and human acceptance remain required.'});
        if(NSProcessInfo.processInfo.environment.objectForKey('G13_INPUT_DIAGNOSTIC')==='1')setTimeout(()=>{
          if(disposed)return;
          action('input-diagnostic-focus',()=>{const field=semanticSnapshot?.nodes.find(node=>node.role==='textbox');if(!field||!semanticAction)throw new Error('Text diagnostic target unavailable.');semanticAction(field.id,'focus');});
        },1500);
        return {log:log.path,parts:source.parts.length,publicPackages:candidate.packages};
      }finally{preparing=false;if(disposed)finishCleanup();}
    },
    bindInput:()=>({
      suspend(){semanticProjection?.suspend();bridge.suspend();touch.suspend();playbackUnlock.pause(player);audio?.suspend();gui?.stopAnimations();record('input-suspended',snapshot());},
      resume(){bridge.resume();touch.resume();semanticProjection?.resume();first=true;status('Tap Unlock to resume audio/playback.');record('input-resumed',{...snapshot(),audio:'A new real Unlock gesture is required.'});},
      snapshot,
      dispose(){for(const release of [()=>bridge.dispose(),()=>touch.dispose()])try{release();}catch(error){record('input-cleanup-error',{error:String(error)});}},
    }),
    disposeScene(){
      if(disposed)return;disposed=true;dismissTextInput=null;playbackUnlock.dispose();abort.abort();offInvalidation?.();offInvalidation=null;engine?.off('update',update);
      const errors:string[]=[];
      for(const release of [()=>player?.dispose(),()=>semanticProjection?.dispose(),()=>bridge.dispose(),()=>touch.dispose()])try{release();}catch(error){errors.push(String(error));}
      record('native-semantics-cleanup',{state:semanticProjection?.snapshot()??null,errors});
      player=null;semanticProjection=null;semanticAction=null;gui=null;root=null;finishCleanup();
    },
  });
  Application.on(Application.exitEvent,dispose);
}
function dispose():void {Application.off(Application.exitEvent,dispose);const current=host;host=null;activeCanvas=null;current?.dispose();}
