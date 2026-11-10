import {Application,File,Folder,knownFolders,path,Page,Label,Device,type EventData} from '@nativescript/core';
import type {Canvas} from '@nativescript/canvas';
import {Entity} from '@haiyue/engine';
import {getEngineDiagnosticsSnapshot} from '@haiyue/engine/diagnostics';
import {GuiRoot,GuiInput,GuiLabel,GuiScrollView,GuiButton,GuiElement,type GuiSystem} from '@haiyue/engine/gui';
import {OwnerSafeAudioMixer} from '@haiyue/engine/audio';
import {GuiTabContainer,attachGuiLayout,createGuiContainer} from '@haiyue/extensions/gui-layout';
import {GuiBreadcrumb,GuiBadge,GuiCollapse} from '@haiyue/extensions/gui-controls';
import {createGuiVirtualList,createGuiVirtualTree} from '@haiyue/extensions/gui-collections';
import {createGameAudio,type GameAudio} from '@haiyue/extensions/audio';
import {NativeRenderHost} from '../../../bridge/lifecycle/host';
import type {NativeCanvasInput} from '../../../bridge/render/surface';
import {NativeTouchInput} from '../../../bridge/input/native-touch.ios';
import {NativeGuiTextInputHost} from '../../../bridge/input/text-input.ios';
import {NativeCanvasTextures} from '../../../bridge/render/canvas-textures.ios';
import {IosGameAudioHost} from '../../../bridge/audio/game-audio.ios';
import {readCandidateIdentity} from './candidate';

let host:NativeRenderHost|null=null,activeCanvas:Canvas|null=null;
const ready=new WeakSet<Canvas>();
export function onCanvasReady(args:EventData):void {const canvas=args.object as Canvas;ready.add(canvas);start(canvas);}
export function onLoaded(args:EventData):void {const canvas=(args.object as Page).getViewById<Canvas>('surface');if(canvas&&ready.has(canvas))start(canvas);}
export function onUnloaded():void {if(!Application.inBackground&&!Application.suspended)dispose();}
function start(canvas:Canvas):void {
  if(host&&activeCanvas!==canvas)dispose();if(host)return;activeCanvas=canvas;
  let gui:GuiSystem|null=null,root:GuiRoot|null=null,textures:NativeCanvasTextures|null=null,offInvalidation:(()=>void)|null=null;
  const cleanup:(()=>void)[]=[];let gameAudio:GameAudio|null=null,mixer:OwnerSafeAudioMixer|null=null,audioHost:IosGameAudioHost|null=null,audioPosition:readonly[number,number]=[0,0],audioEvent=0,fadeRemaining=0,audioWanted=false;
  let toneBuffer:AudioBuffer|null=null,playbackProbe:ReturnType<typeof setTimeout>|undefined;
  const cancelPlaybackProbe=()=>{if(playbackProbe!==undefined)clearTimeout(playbackProbe);playbackProbe=undefined;};
  const fields:GuiInput[]=[],journal:string[]=[];
  const session=String(Date.now()),sessionFolder=Folder.fromPath(path.join(knownFolders.documents().path,'g11-sessions',session));
  const log=File.fromPath(path.join(sessionFolder.path,'gameplay-input.jsonl'));
  const snapshot=()=>({focus:gui?.focus.focused?.id??null,fields:fields.map(input=>({id:input.id,value:input.inputType==='password'?'[redacted]':input.value,selection:[input.selectionAnchor,input.selectionFocus],composing:input.isComposing,rect:{...input.rect}}))});
  const record=(event:string,detail:unknown)=>{
    const row=JSON.stringify({time:new Date().toISOString(),event,detail,state:snapshot()});journal.push(row);if(journal.length>5000)journal.splice(1,1);
    console.log('[G11] '+row);log.writeTextSync(journal.join('\n')+'\n');
  };
  const nativeView=canvas.nativeViewProtected as UIView;
  const recognizers=()=>{
    const list=nativeView.gestureRecognizers;
    return list?Array.from({length:list.count},(_,index)=>list.objectAtIndex(index)):[];
  };
  const originalRecognizers=recognizers();
  const bridge=new NativeGuiTextInputHost(nativeView,record);
  const touch=new NativeTouchInput(canvas,()=>host?.requestFrame());
  const input:NativeCanvasInput={addEventListener:touch.target.addEventListener.bind(touch.target),removeEventListener:touch.target.removeEventListener.bind(touch.target),setPointerCapture:touch.target.setPointerCapture.bind(touch.target),releasePointerCapture:touch.target.releasePointerCapture.bind(touch.target)} as unknown as NativeCanvasInput;
  const status=(text:string)=>{const label=(canvas.page as Page).getViewById<Label>('status');if(label)label.text=text;};
  host=new NativeRenderHost(canvas,status,{
    diagnosticName:`g11-sessions/${session}/lifecycle`,enginePackageVersion:'0.2.3 candidate (see vendor/qualified-candidate.json)',canvasInput:input,diagnosticIntervalFrames:0,
    engineOptions:{diagnostics:{enabled:true}},
    needsAnimationFrame:()=>Boolean(gui?.animating)||fadeRemaining>0,
    prepareScene(engine){
      const candidate=readCandidateIdentity(File.fromPath(path.join(knownFolders.currentApp().path,'qualified-candidate.json')).readTextSync());
      record('candidate',{candidateId:candidate.candidateId,enginePackage:candidate.enginePackage,extensionsPackage:candidate.extensionsPackage});
      textures=new NativeCanvasTextures(engine.device);
      const readAtlasPixels=(canvas:HTMLCanvasElement)=>{
        const pixels=textures!.readAtlasPixels(canvas);let coloredPixels=0;
        for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]!>0&&(pixels[i]!==pixels[i+1]||pixels[i+1]!==pixels[i+2]))coloredPixels++;
        record('font-atlas',{width:canvas.width,height:canvas.height,coloredPixels});return pixels;
      };
      const scene=engine.createScene({name:'G11 native GUI and audio',render3D:false,render2D:false,gui:{loadOp:'clear',textInputHost:{open:request=>bridge.open({...request,onViewportInset:inset=>request.onViewportInset({...inset,top:Math.max(144,inset.top)})})},font:{canvasFactory:textures.createCanvas2D,readAtlasPixels,fontFamily:'sans-serif',chars:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 中文你好取消提交A😀Bé👩🏽‍💻•/():;,.?!-_|'}}});
      gui=scene.guiSystem!;root=new GuiRoot({theme:{fontSize:18}});
      const scroll=root.add(new GuiScrollView({width:'100%',height:'100%',contentHeight:3700,focus:{mode:'none'}}));
      scroll.add(new GuiLabel({x:20,y:160,width:'90%',height:50,fontSize:22,text:'G11 native text / GUI / audio'}));
      const add=(id:string,title:string,y:number,value:string,multiline=false,inputType:'text'|'password'|'email'|'number'='text')=>{
        scroll.add(new GuiLabel({x:'10%',y:y-30,width:'80%',height:26,text:title,fontSize:16}));
        const field=scroll.add(new GuiInput({id,x:'10%',y,width:'80%',height:multiline?120:44,value,multiline,inputType,onChange:()=>record('committed-change',{id}),onSubmit:()=>record('submit',{id})}));fields.push(field);return field;
      };
      add('a','A: emoji / Chinese IME',255,'A😀B');add('b','B: combining / ZWJ / two emoji',370,'e\u0301👩🏽‍💻😀😀');
      const limit=add('limit','UTF-16 limit: 4',485,'A😀B');limit.maxLength=4;
      add('password','Password (test text only)',600,'',false,'password');add('multiline','Multiline / rotate / keyboard',720,'A😀B\n中文\ne\u0301',true);
      add('email','Email keyboard hint',955,'test@example.com',false,'email');add('number','Decimal keyboard hint',1070,'12.3',false,'number');
      const selected=()=>gui?.focus.focused instanceof GuiInput?gui.focus.focused:null;
      root.add(new GuiElement({width:'100%',height:144,style:{backgroundColor:'#091322'}}));
      const button=(title:string,column:number,y:number,action:()=>void)=>root!.add(new GuiButton({x:`${column*22+7}%`,y,width:'20%',height:32,text:title,focus:{mode:'none'},onClick:()=>{action();host?.requestFrame();}}));
      button('Select',0,64,()=>selected()?.selectAll());button('Undo',1,64,()=>selected()?.undo());button('Redo',2,64,()=>selected()?.redo());
      button('Cancel',3,64,()=>{selected()?.cancelComposition();gui?.focus.blur();record('explicit-cancel',bridge.snapshot());});
      button('Copy',0,104,()=>bridge.copySelection());button('Cut',1,104,()=>bridge.copySelection(true));button('Paste',2,104,()=>bridge.paste());button('Save',3,104,()=>record('human-checkpoint',bridge.snapshot()));
      scroll.add(new GuiLabel({x:20,y:1150,width:'88%',height:100,text:'Use test text only. Candidates must follow the caret. Rotate; background during preedit; return and edit again.',fontSize:15}));
      const area=scroll.add(new GuiElement({x:'5%',y:1260,width:'90%',height:2020,pointerFilter:'ignore'}));
      const crumb=new GuiBreadcrumb({focus:gui.focus,items:['Home','Settings','Load','Level','Map','Items','Audio','Current'].map((label,i)=>({key:i===0?'home':i===1?'settings':'crumb-'+i,label,...(i===1?{menu:[{key:'list',label:'List'},{key:'text',label:'Text'}]}:{}),disabled:i===2})),onNavigate:key=>{record('g11-breadcrumb',{key});tabs.activate(key==='list'?'list':'controls');host?.requestFrame();}});
      area.add(new GuiElement({width:'100%',height:100,pointerFilter:'ignore'})).add(crumb.element);
      let clicks=0;const badges=Array.from({length:32},(_,i)=>{const badge=new GuiBadge({content:new GuiButton({width:74,height:30,text:String(i+1),onClick:()=>{badge.setValue(++clicks);record('g11-badge',{index:i,clicks});}}),value:i===1?99:i===2?100:i});area.add(new GuiElement({x:`${i%4*25}%`,y:112+Math.floor(i/4)*38,width:'25%',height:34,pointerFilter:'ignore'})).add(badge.element);return badge;});
      const editor=new GuiInput({id:'g11-collapse-editor',width:'100%',height:44,value:'你好 A',onChange:()=>record('g11-collapse-text',{})});fields.push(editor);
      const collapse=new GuiCollapse({focus:gui.focus,items:Array.from({length:16},(_,i)=>({key:'panel-'+i,title:i?'Panel '+i:'Edit then collapse',content:i?new GuiLabel({width:'100%',height:32,text:'Preserved content '+i}):editor})),expandedKeys:['panel-0'],onExpandChange:keys=>record('g11-collapse',{keys,composing:editor.isComposing,value:editor.value})});
      const edits=new Map<string,string>();
      const list=createGuiVirtualList({items:Array.from({length:1000},(_,i)=>({key:'item-'+i,value:'Item '+i})),keyOf:item=>item.key,rowHeight:28,height:560,focus:gui.focus,createRow(){const row=new GuiInput({width:'100%',height:28});fields.push(row);return{element:row,bind(item,key){row.setValue(edits.get(key)??item.value);const change=(value:string)=>{edits.set(key,value);record('g11-list-edit',{key,value});};row.onChange=change;return()=>{if(row.onChange===change)row.onChange=null;};},dispose(){const i=fields.indexOf(row);if(i>=0)fields.splice(i,1);row.removeAllListeners();}};}});
      const tree=createGuiVirtualTree({nodes:Array.from({length:10},(_,i)=>({key:'group-'+i,value:'Group '+i,children:Array.from({length:100},(_,j)=>({key:'node-'+i+'-'+j,value:'Node '+i+'/'+j}))})),expandedKeys:['group-0'],rowHeight:28,height:560,focus:gui.focus,createRow(){const row=new GuiButton({width:'100%',height:28});return{element:row,bind(node){row.setText(node.value);return()=>{};},dispose(){row.removeAllListeners();}};}});
      const runAudio=(action:()=>Promise<void>|void)=>{void Promise.resolve().then(action).catch(error=>{record('g11-audio-failed',{reason:String(error)});status('Audio requires investigation: '+String(error));});};
      const unlockAudio=async()=>{
        if(!mixer){audioHost=new IosGameAudioHost(record);mixer=new OwnerSafeAudioMixer({host:audioHost});}
        const activeMixer=mixer,output=audioHost!;
        await activeMixer.resume();
        if(mixer!==activeMixer)return null;
        const stereo=activeMixer.getCapabilities().stereoPan;
        const browserGlobals=globalThis as {AudioContext?:unknown;webkitAudioContext?:unknown};
        record('g11-audio-capability',{backend:'av-audio-engine',webAudioAvailable:typeof browserGlobals.AudioContext==='function'||typeof browserGlobals.webkitAudioContext==='function',status:stereo?'supported':'unsupported',stereo,stats:activeMixer.stats,native:output.snapshot(),qualification:stereo?'pending-human-hearing':'blocked'});
        return {activeMixer,output,stereo};
      };
      const getToneBuffer=(output:IosGameAudioHost)=>{
        if(!toneBuffer){
          const rate=48000,buffer=output.createBuffer(1,rate,rate),data=buffer.getChannelData(0);
          for(let i=0;i<data.length;i++)data[i]=.15*Math.sin(2*Math.PI*440*i/rate);
          toneBuffer=buffer;
        }
        return toneBuffer;
      };
      const prepareGameAudio=async()=>{
        const session=await unlockAudio();
        if(!session||mixer!==session.activeMixer)return false;
        const {activeMixer,output,stereo}=session;
        if(!stereo){status('Stereo capability unavailable: qualification blocked.');return false;}
        if(!activeMixer.stats.buffers)activeMixer.installBuffer('g11-tone',getToneBuffer(output));
        if(!gameAudio){
          const audio=createGameAudio({mixer:activeMixer,listener:()=>[0,0]});
          try{cleanup.push(audio.bindEmitter2D({owner:'native-probe',channel:'tone',position:()=>audioPosition,maxDistance:100,panStrength:10}));}
          catch(error){audio.dispose();throw error;}
          gameAudio=audio;
        }
        audioWanted=true;
        return true;
      };
      const audioButton=(text:string,action:()=>Promise<void>|void)=>new GuiButton({width:'100%',height:40,text,onClick:()=>runAudio(action)});
      const sounds=createGuiContainer('column',{style:{width:{percent:100},height:'auto',contentMinimum:true,rowGap:6}});
      sounds.add(audioButton('Probe / unlock actual audio',async()=>{await unlockAudio();}));
      sounds.add(audioButton('Measure native audio signal',async()=>{
        if(!await prepareGameAudio())return;
        const output=audioHost!,measurement=await output.measureCenterSignal(toneBuffer!);
        if(audioHost!==output)return;
        record('g11-audio-offline-signal',measurement);
        status('Signal measured. Now check Hear center.');
      }));
      for(const [text,x,y]of[['Hear left',-10,0],['Hear center',0,10],['Hear right',10,0],['Distance 100: silent',100,0]]as const)sounds.add(audioButton(text,async()=>{
        if(!await prepareGameAudio())return;
        audioPosition=[x,y];
        const voice=gameAudio!.play({eventId:'native-'+(++audioEvent),owner:'native-probe',channel:'tone',bufferId:'g11-tone',bus:'ui',loop:true,startTick:audioEvent});
        gameAudio!.update(0);
        record('g11-audio-position',{x,y,voice,stats:mixer!.stats});
        cancelPlaybackProbe();
        const output=audioHost!;
        playbackProbe=setTimeout(()=>{
          playbackProbe=undefined;
          if(audioHost===output)record('g11-audio-live-clock',{x,y,voice,...output.playbackSnapshot()});
        },250);
      }));
      sounds.add(audioButton('Play iOS reference tone',async()=>{
        const session=await unlockAudio();
        if(!session||mixer!==session.activeMixer)return;
        cancelPlaybackProbe();
        session.activeMixer.stop('native-probe','tone');
        session.output.playReferenceTone(getToneBuffer(session.output));
        record('g11-audio-reference',{backend:'av-audio-player',...session.output.playbackSnapshot()});
      }));
      sounds.add(audioButton('Fade UI over 2 seconds',()=>{if(gameAudio){gameAudio.fadeBus('ui',0,2000);fadeRemaining=2000;host?.requestFrame();}}));
      sounds.add(audioButton('Mute / unmute',()=>{if(gameAudio){gameAudio.setMuted(!gameAudio.exportProfile().muted);record('g11-audio-profile',gameAudio.exportProfile());}}));
      sounds.add(audioButton('Reset audio volumes',()=>{if(gameAudio){gameAudio.setVolumes({master:1,music:1,sfx:1,ui:1});gameAudio.setMuted(false);record('g11-audio-profile',gameAudio.exportProfile());}}));
      sounds.add(audioButton('Suspend / resume',async()=>{if(!gameAudio)return;audioWanted=mixer!.stats.state==='suspended';if(audioWanted)await gameAudio.resume();else await gameAudio.suspend();record('g11-audio-state',mixer!.stats);}));
      const colors=['#3b82f6','#f59e0b'],icons=colors.map(color=>{const image=textures!.createCanvas2D(16,16),context=image.getContext('2d')!;context.fillStyle=color;context.fillRect(2,2,12,12);return image;});
      const pages=[{id:'controls',title:'Controls',content:collapse.element},{id:'list',title:'List',content:list.element},{id:'tree',title:'Tree',content:tree.element},{id:'audio',title:'Audio',content:sounds},...Array.from({length:8},(_,i)=>({id:'extra-'+i,title:'Tab '+(i+5),content:new GuiLabel({width:'100%',height:40,text:'Icon and theme '+(i+5)} )}))];
      const scrolls=pages.map(page=>{const view=new GuiScrollView({width:'100%',height:'100%',contentHeight:0,showScrollbar:true});view.add(page.content);return view;});let configureActive=()=>{};
      const tabs=new GuiTabContainer({focus:gui.focus,tabWidth:94,tabHeight:36,pages:pages.map((page,i)=>({...page,content:scrolls[i]!,icon:icons[i%2]!,iconPosition:i%2?'right' as const:'left' as const})),onActiveChange:()=>{configureActive();record('g11-tab',{active:tabs.activeId});host?.requestFrame();}});
      area.add(new GuiElement({y:432,width:'100%',height:1390,pointerFilter:'ignore'})).add(tabs.element);
      const layout=attachGuiLayout(root);layout.setStyle(crumb.element,{width:{percent:100},height:100});for(const badge of badges)layout.setStyle(badge.element,{width:74,height:30});layout.setStyle(tabs.element,{width:{percent:100},height:1390});
      configureActive=()=>{const index=pages.findIndex(page=>page.id===tabs.activeId);if(index>=0)layout.setStyle(scrolls[index]!,{direction:'column'});};configureActive();
      area.add(new GuiButton({y:1840,width:'100%',height:40,text:'Checkpoint controls / audio',onClick:()=>record('g11-human-checkpoint',{active:tabs.activeId,expanded:collapse.getExpandedKeys(),list:list.stats,tree:tree.stats,badgeClicks:clicks,audio:mixer?.stats??{state:'not-probed'},profile:gameAudio?.exportProfile()??null})}));
      const audioFrame=(event:{detail:{delta:number}})=>{if(gameAudio){const delta=Math.max(0,event.detail.delta);gameAudio.update(delta);fadeRemaining=Math.max(0,fadeRemaining-delta);}};engine.on('after-update',audioFrame);
      cleanup.push(()=>{engine.off('after-update',audioFrame);tabs.dispose();crumb.dispose();for(const badge of badges)badge.dispose();collapse.dispose();list.dispose();tree.dispose();layout.dispose();record('g11-controls-disposed',{list:list.stats,tree:tree.stats});});
      record('g11-workload',{tabs:12,breadcrumbs:8,badges:32,collapsePanels:16,listItems:1000,treeChildren:1000,viewportRows:20,rowHeight:28});
      scroll.add(new GuiButton({x:20,y:3370,width:'88%',height:40,text:'End and save cleanup evidence',onClick:()=>{
        record('human-end',bridge.snapshot());
        setTimeout(()=>{
          const before=getEngineDiagnosticsSnapshot(engine).gpuResources;
          dispose();
          const remaining=recognizers();
          record('g11-device-cleanup',{gpuBefore:before,gpuAfter:getEngineDiagnosticsSnapshot(engine).gpuResources,
            viewRecognizersBefore:originalRecognizers.length,viewRecognizersAfter:remaining.length,
            recognizersAddedSinceStart:remaining.filter(item=>!originalRecognizers.some(initial=>initial.isEqual(item))).length});
          status('G11 closed. Export input and lifecycle JSONL files.');
        },0);
      }}));
      scene.add(new Entity('g06-ui').addComponent(root));engine.switchScene(scene);
      offInvalidation=root.onInvalidation(()=>host?.requestFrame());
      record('environment',{model:Device.model,os:Device.os,osVersion:Device.osVersion,canvas:'2.1.18',nativeRuntime:'9.0.3',qualification:'Human device evidence pending; checkpoints alone do not assert success.'});
      return {scene:'G11 0.2.3',log:log.path};
    },
    bindInput:()=>({suspend(){cancelPlaybackProbe();bridge.suspend();touch.suspend();gui?.stopAnimations();if(mixer)void mixer.suspend().then(()=>record('g11-audio-background',mixer?.stats)).catch(error=>record('g11-audio-failed',{reason:String(error)}));record('input-suspended',bridge.snapshot());},resume(){bridge.resume();touch.resume();if(audioWanted&&gameAudio)void gameAudio.resume().then(()=>record('g11-audio-restored',mixer?.stats)).catch(error=>record('g11-audio-failed',{reason:String(error)}));record('input-resumed',bridge.snapshot());},snapshot:()=>({text:bridge.snapshot(),touch:touch.snapshot(),audio:mixer?.stats??null}),dispose(){bridge.dispose();touch.dispose();record('input-disposed',bridge.snapshot());}}),
    disposeScene(){cancelPlaybackProbe();offInvalidation?.();offInvalidation=null;for(const close of cleanup.reverse())close();cleanup.length=0;gameAudio?.dispose();mixer?.dispose();record('g11-audio-disposed',{...(mixer?.stats??{state:'not-created'}),native:audioHost?.snapshot()??null});gameAudio=null;mixer=null;audioHost=null;toneBuffer=null;audioWanted=false;textures?.dispose();textures=null;gui=null;root=null;fields.length=0;},
  });
  Application.on(Application.exitEvent,dispose);
}
function dispose():void {Application.off(Application.exitEvent,dispose);host?.dispose();host=null;activeCanvas=null;}
