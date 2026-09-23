import {profileTransitions} from './profile-transitions';
import {Application,isAndroid,Color,File,Label,Screen,knownFolders,path,alert,confirm,type EventData} from '@nativescript/core';
import {Canvas} from '@nativescript/canvas';
import {LocalStorageSaveBackend} from '@haiyue/engine/save';
import type {HaiyueEngine} from '@haiyue/engine';
import {parseQuality,resolvePixelRatio,type QualitySettings} from '../../../../Games/games/boxbound/quality';
import {MobileSettingsStorage} from './storage';
import {NativeRenderHost} from '../../../bridge/lifecycle/host';
import {nativeLaunchFlag} from '../../../bridge/lifecycle/launch-flags';
import {NativeEngineLaunchPage} from '../../../bridge/branding/launch-page';
import {NativeTouchInput} from '../../../bridge/input/native-touch';
import {nativeViewRect} from '../../../bridge/render/view-rect';
import type {NativeCanvasInput} from '../../../bridge/render/surface';
import {installWorldMap,loadWorldMap} from '../../../../Games/games/boxbound/world-map';
import {createGame} from '../../../../Games/games/boxbound/levels';
import {BoxboundScene} from '../../../../Games/games/boxbound/scene';
import {BoxboundSaves} from '../../../../Games/games/boxbound/saves';
import {MobileSession} from './session';
import {MobileAudio} from './audio';
import {MobileGui} from './gui';
import {stickDirection,createStick} from './controls';
import {runSmoke} from './smoke';
import {profileMobile} from './profile';
import {probeGpu} from './gpu-probe';
import {runResourceStress} from './resource-stress';
let active:MobileGame|null=null;
export function onLoaded(args:EventData){if(!active)active=new MobileGame(args.object as NativeEngineLaunchPage);}
export function onUnloaded(){if(!Application.inBackground&&!Application.suspended){active?.dispose();active=null;}}
export class MobileGame {
 readonly canvas=new Canvas();
 session:MobileSession|null=null;scene:BoxboundScene|null=null;host:NativeRenderHost|null=null;saves:BoxboundSaves|null=null;engine:HaiyueEngine|null=null;audio:MobileAudio|null=null;gui:MobileGui|null=null;
 gpuProbe:ReturnType<typeof probeGpu>|null=null;
 slot=1;ready=false;disposed=false;busy=false;smoke=false;private shown=false;private activeSlot:number|null=null;private summaries:Awaited<ReturnType<BoxboundSaves['summaries']>>=[];
 readonly stickInput=createStick(()=>nativeViewRect(this.canvas),(point)=>!!this.session&&!this.session.home&&!this.session.paused&&!this.busy&&!this.gui?.ownsPoint(point.x,point.y));
 quality:QualitySettings={msaa:true,pixelRatio:'auto'};settingsOpen=false;private qualityPending=false;
 private input:NativeTouchInput|null=null;
 private readonly status=new Label();private readonly storage=new MobileSettingsStorage();
 constructor(readonly page:NativeEngineLaunchPage){
  const root=page.gameRoot;root.iosOverflowSafeArea=true;this.canvas.iosOverflowSafeArea=true;root.backgroundColor=new Color('#eef0df');
  this.smoke=(isAndroid ? !!(Application.android.context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) : NSBundle.mainBundle.objectForInfoDictionaryKey('HYBuildConfiguration')==='Debug')&&nativeLaunchFlag('BOXBOUND_SMOKE');
  this.quality=parseQuality(this.storage.getItem(this.smoke?'boxbound-quality-smoke':'boxbound-quality'));
  this.canvas.ignoreTouchEvents=true;this.canvas.id='surface';root.addChild(this.canvas);
  this.status.text='正在打开盒中世界…';this.status.horizontalAlignment='center';this.status.verticalAlignment='middle';root.addChild(this.status);
  this.canvas.on('ready',this.attach);if(isAndroid)Application.android.on('activityBackPressed',this.back);
 }
 readonly handleTouch=(sample:{action:string;points:{id:number;x:number;y:number}[]})=>{
  const {action,points}=sample;
  if(action==='down'||action==='move'||action==='up'||action==='cancel')this.stickInput.target.handle(action,points);
  else this.releaseStick();
  this.syncStick();this.requestFrame();
 };
 private readonly safeInsets=()=>{
  const i=!isAndroid?(this.canvas.nativeViewProtected as UIView|undefined)?.safeAreaInsets:undefined;
  return {left:i?.left??0,right:i?.right??0,top:i?.top??0,bottom:i?.bottom??0};
 };
 private syncStick(){const v=this.stickInput.joystick.state;this.gui?.updateStick(v);this.session?.setDirection(stickDirection(v.direction.x,v.direction.y,this.session.held));}
 readonly requestFrame=()=>{this.scene?.requestPresent();this.host?.requestFrame();};
 private readonly attach=()=>{if(this.host||this.disposed)return;this.input=new NativeTouchInput(this.canvas,this.handleTouch);const target=this.stickInput.target;
  this.host=new NativeRenderHost(this.canvas,text=>{if(text.startsWith('原生 WebGPU 已呈现'))this.status.visibility='collapse';else{this.status.text=text;this.status.visibility='visible';if(text.includes('失败'))this.page.splash.fail(text);}}, {
   canvasInput:{addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target),setPointerCapture:(id:number)=>{try{target.setPointerCapture(id);}catch(e){if(!(e instanceof Error)||e.message!=='Cannot capture an inactive native touch.')throw e;}},releasePointerCapture:target.releasePointerCapture.bind(target)} as unknown as NativeCanvasInput,
   engineOptions:{renderProfile:'batched',msaaSamples:this.quality.msaa?4:1,clearColor:{r:.9294,g:.9412,b:.8745,a:1}},diagnosticName:'boxbound',performance:this.smoke,diagnosticIntervalFrames:0,capture:{requested:this.smoke&&!nativeLaunchFlag('BOXBOUND_TRANSITIONS'),file:'boxbound-frame.png'},
   needsAnimationFrame:()=>!!(this.scene?.hasPendingFrame||this.session?.needsTick||this.audio?.pending),
   prepareScene:async engine=>{
    this.engine=engine;if(this.smoke)this.gpuProbe=probeGpu();engine.devicePixelRatio=resolvePixelRatio(this.quality.pixelRatio,Screen.mainScreen.scale);
    const base=path.join(knownFolders.currentApp().path,'game/levels/index.json');installWorldMap(await loadWorldMap(new URL('file://'+base),async url=>JSON.parse(await File.fromPath(decodeURIComponent(url.pathname)).readText())));
    this.saves=new BoxboundSaves(new LocalStorageSaveBackend({namespace:this.smoke?'boxbound-native-smoke':'haiyue-games',storage:this.storage}));
    this.session=new MobileSession();this.session.wake=this.requestFrame;
    this.gui=new MobileGui(engine,this.session.state,{undo:()=>this.session?.undo(),exit:()=>{this.releaseStick();this.session?.exit();},jump:()=>this.session?.jump(),dive:()=>this.session?.act({type:'dive'}),menu:()=>void this.openMenu(),start:fresh=>void this.start(fresh),slot:n=>{this.slot=n;this.paint();},help:()=>void this.help(),reset:()=>void this.reset(),replay:()=>{this.releaseStick();this.session?.reset();},settings:()=>this.openSettings(),closeSettings:()=>this.closeSettings(),quality:value=>this.setQuality(value),sound:()=>{if(this.audio){this.audio.muted=!this.audio.muted;if(this.audio.muted)this.audio.stop();if(!this.smoke)this.storage.setItem('boxbound-muted',String(this.audio.muted));this.paint();}}},this.safeInsets);
    await this.gui.loadTextures();
    // Input/session is applied before the scene update, including the first movement frame.
    engine.on('update',this.tick);const canvas=this.canvas;
    this.scene=new BoxboundScene(engine,{get width(){return engine.width;},get height(){return engine.height;},get clientWidth(){return nativeViewRect(canvas).width;},get clientHeight(){return nativeViewRect(canvas).height;},style:{opacity:'1'}},this.gui.labelsPort());
    this.scene.applyQuality(this.quality.msaa,resolvePixelRatio(this.quality.pixelRatio,Screen.mainScreen.scale));
    this.scene.attachOverlay(this.gui.entity,this.gui.system);
    this.session.scene=this.scene;this.session.changed=()=>this.paint();this.session.save=state=>{const slot=this.slot;void this.saves!.save(slot,state).catch(e=>{this.gui!.toast.setText('保存失败，请稍后重试。');this.requestFrame();console.error(e);});};
    this.audio=new MobileAudio();if(!this.smoke)this.audio.muted=this.storage.getItem('boxbound-muted')==='true';void this.audio.load();this.session.audio=cues=>this.audio?.schedule(cues);
    this.summaries=await this.saves.summaries();this.scene.show(this.session.state);this.ready=true;this.status.visibility='collapse';engine.on('after-update',this.presented);this.paint();return this.snapshot();
   },
   bindInput:(_engine,report)=>{if(this.smoke)setTimeout(()=>void (nativeLaunchFlag('BOXBOUND_TRANSITIONS')?profileTransitions(this,report):(nativeLaunchFlag('BOXBOUND_PROFILE')?profileMobile(this,report):Promise.resolve()).then(()=>runSmoke(this,report)).then(()=>nativeLaunchFlag('BOXBOUND_STRESS')?runResourceStress(this,report):undefined)).catch(e=>report('smoke-failed',{error:String(e)})),1500);
    return{suspend:()=>{this.input?.suspend();this.releaseStick();this.session?.cancel();if(this.session)this.session.paused=true;this.audio?.stop();void this.flushSaves();},resume:()=>{this.input?.resume();if(this.session)this.session.paused=this.settingsOpen;this.requestFrame();},dispose:()=>this.input?.dispose(),snapshot:()=>this.snapshot()};
   },disposeScene:()=>{this.engine?.off('update',this.tick);this.engine?.off('after-update',this.presented);this.scene?.dispose();this.gui?.dispose();this.audio?.dispose();this.gpuProbe?.dispose();}
  });
 };
 private readonly tick=({detail}:{detail:{delta:number}})=>{if(this.qualityPending&&this.scene){this.qualityPending=false;this.scene.applyQuality(this.quality.msaa,resolvePixelRatio(this.quality.pixelRatio,Screen.mainScreen.scale));}this.stickInput.joystick.step(Math.max(0,detail.delta));this.session?.tick(performance.now());this.audio?.tick();};
 private readonly presented=()=>{if(!this.shown){this.shown=true;this.page.splash.presented();}};
 releaseStick(){this.stickInput.target.cancel();this.stickInput.joystick.cancel();this.session?.setDirection(null);this.gui?.updateStick(this.stickInput.joystick.state);this.requestFrame();}
 paint(){if(!this.session||!this.gui)return;const slots=new Set(this.summaries.map(s=>Number(s.saveId.split('-')[1])));if(this.activeSlot!==null)slots.add(this.activeSlot);this.gui.update(this.session.state,!this.session.home,this.slot,slots,!!this.session.history.length,this.busy,this.audio?.muted??false,this.quality,this.settingsOpen,Screen.mainScreen.scale);this.requestFrame();}
  openSettings(){this.releaseStick();this.session?.cancel();if(this.session)this.session.paused=true;this.settingsOpen=true;this.paint();}
  closeSettings(){this.storage.flush();this.settingsOpen=false;if(this.session)this.session.paused=false;this.paint();}
  setQuality(value:QualitySettings){this.quality=parseQuality(JSON.stringify(value));this.qualityPending=true;this.storage.setItem(this.smoke?'boxbound-quality-smoke':'boxbound-quality',JSON.stringify(this.quality));this.paint();}
  private async flushSaves(){await this.saves?.service.flush();this.storage.flush();}
  async start(fresh:boolean){if(!this.ready||this.busy||!this.session||!this.saves)return;this.busy=true;this.paint();try{
      if(fresh&&!this.smoke&&this.summaries.some(x=>x.saveId===`journey-${this.slot}`)&&!await confirm({title:'重新开始旅程？',message:'这会替换当前所选存档，其他旅程不受影响。',okButtonText:'重新开始',cancelButtonText:'保留存档'}))return;
      if(!fresh&&this.activeSlot===this.slot){this.session.home=false;this.scene!.home=false;this.requestFrame();return;}
      await this.flushSaves();const loaded=fresh?null:await this.saves.load(this.slot);const state=loaded??createGame();this.session.load(state);this.activeSlot=this.slot;if(!loaded)await this.saves.save(this.slot,state);
    }catch(e){await alert({title:'无法打开旅程',message:String(e),okButtonText:'知道了'});}finally{this.busy=false;this.paint();}}
  async openMenu(){if(!this.session||this.busy)return;this.releaseStick();this.session.cancel();this.session.home=true;this.audio?.stop();this.scene!.home=true;this.scene!.invalidate();this.paint();await this.flushSaves();this.summaries=await this.saves!.summaries();this.paint();}
  async help(){this.releaseStick();const release=this.host?.pausePresentation();try{await alert({title:'箱庭迷境 · 玩法',message:'左侧摇杆控制移动和推箱；按住摇杆可连续移动。\n右侧跳跃：单按原地跳跃，配合摇杆登上台阶或盒顶。\n下钻：从盒顶进入，或从有开口的一侧进入。四周封闭的关卡先跳到盒顶再下钻；封闭侧可以推动盒子。\n右上角撤销一步；退出可直接回到当前关卡外层。\n将箱子推到对应颜色的方框，再站到笑脸终点。Parabox 平面关不能跳过箱子。\n通关小关卡后自动保存，五段旅程互相独立。',okButtonText:'开始探索'});}finally{release?.();}}
  async reset(){if(!this.session?.state.rooms[this.session.state.player.room]?.level){await alert({title:'重玩关卡',message:'进入一个关卡后可以重玩。',okButtonText:'知道了'});return;}if(await confirm({title:'重玩当前关卡？',message:'重置当前关卡内的箱子，保留通关记录。',okButtonText:'重玩',cancelButtonText:'返回'})){this.session.home=false;this.scene!.home=false;this.session.reset();this.paint();}}
  private readonly back=(e:EventData&{cancel?:boolean})=>{e.cancel=true;if(this.settingsOpen){this.closeSettings();return;}if(!this.session)return;if(this.session.home){if(this.ready)void this.start(false);}else if(this.session.state.player.route.length)this.session.exit();else void this.openMenu();};

 snapshot(){return{safeInsets:this.safeInsets(),audio:this.audio?.snapshot(),touch:this.input?.snapshot(),gpuProbe:this.gpuProbe?.snapshot(),quality:this.quality,settingsOpen:this.settingsOpen,msaaSamples:this.engine?.msaaSamples,pixelRatio:this.engine?.devicePixelRatio,title:'箱庭迷境',ready:this.ready,smoke:this.smoke,home:this.session?.home,slot:this.slot,room:this.session?.state.player.room,moves:this.session?.state.moves,completed:this.session?.state.completed,viewport:this.canvas.getActualSize(),gui:'Haiyue GuiSystem',stick:this.stickInput.joystick.state,stickVisible:this.gui?.stickBase.visible,jump:this.gui?.jump.rect,dive:this.gui?.dive.rect,held:this.session?.held,undo:this.session?.history.length,splash:this.page.splash.status,rendering:this.host?.renderingSnapshot()};}
 dispose(){if(this.disposed)return;this.disposed=true;if(isAndroid)Application.android.off('activityBackPressed',this.back);this.canvas.off('ready',this.attach);this.input?.dispose();this.releaseStick();this.stickInput.joystick.destroy();this.stickInput.target.dispose();void this.flushSaves();this.host?.dispose();this.page.splash.dispose();}
}
