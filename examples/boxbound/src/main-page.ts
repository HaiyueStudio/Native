import {Application,AbsoluteLayout,Button,Color,File,GridLayout,Label,StackLayout,knownFolders,path,alert,confirm,type EventData,type TouchGestureEventData} from '@nativescript/core';
import {Canvas} from '@nativescript/canvas';
import {LocalStorageSaveBackend} from '@haiyue/engine/save';
import type {HaiyueEngine} from '@haiyue/engine';
import {NativeSettingsStorage} from '../../../bridge/storage/settings-storage';
import {NativeRenderHost} from '../../../bridge/lifecycle/host';
import {nativeLaunchFlag} from '../../../bridge/lifecycle/launch-flags';
import {NativeEngineLaunchPage} from '../../../bridge/branding/launch-page';
import {installWorldMap,loadWorldMap} from '../../../../Games/games/boxbound/world-map';
import {createGame} from '../../../../Games/games/boxbound/levels';
import {BoxboundScene} from '../../../../Games/games/boxbound/scene';
import {BoxboundSaves} from '../../../../Games/games/boxbound/saves';
import {levelIds} from '../../../../Games/games/boxbound/model';
import {MobileSession} from './session';
import {NativeLabels} from './labels';
import {MobileAudio} from './audio';
import {stickDirection,stickThumb} from './controls';
import {runSmoke} from './smoke';
const label=(text:string,size=14)=>{const l=new Label();l.text=text;l.fontSize=size;return l;};
const button=(text:string,id:string,action:()=>void)=>{const b=new Button();b.text=text;b.id=id;b.accessibilityLabel=text;b.height=44;b.textWrap=true;b.on('tap',action);return b;};
let active:MobileGame|null=null;
export function onLoaded(args:EventData){if(!active)active=new MobileGame(args.object as NativeEngineLaunchPage);}
export function onUnloaded(){if(!Application.inBackground&&!Application.suspended){active?.dispose();active=null;}}
export class MobileGame {
  readonly canvas=new Canvas(); readonly labels=new AbsoluteLayout(); readonly controls=new GridLayout();readonly hud=new GridLayout();readonly menu=new GridLayout();
  readonly stick=new GridLayout();readonly thumb=new GridLayout();readonly title=label('箱庭迷境',21);readonly room=label('正在打开盒中世界…',12);readonly toast=label('',12);
  readonly undo:Button;readonly exit:Button;readonly jump:Button;readonly dive:Button;
  readonly menuTitle=label('箱庭迷境',30);readonly menuInfo=label('每个盒子里，都藏着一个世界。',13);readonly slots=new GridLayout();readonly continueButton:Button;
  session:MobileSession|null=null;scene:BoxboundScene|null=null;host:NativeRenderHost|null=null;saves:BoxboundSaves|null=null;engine:HaiyueEngine|null=null;audio:MobileAudio|null=null;
  slot=1;ready=false;disposed=false;busy=false;smoke=false;private shown=false;private summaries:Awaited<ReturnType<BoxboundSaves['summaries']>>=[];
  private readonly status=label('正在加载…',14);private readonly storage=new NativeSettingsStorage();
  constructor(readonly page:NativeEngineLaunchPage){
    const root=page.gameRoot;root.backgroundColor=new Color('#eef0df');
    this.smoke=!!(Application.android.context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)&&nativeLaunchFlag('BOXBOUND_SMOKE');
    this.canvas.ignoreTouchEvents=true;this.canvas.id='surface';root.addChild(this.canvas);
    this.labels.isUserInteractionEnabled=false;root.addChild(this.labels);
    this.hud.height=54;this.hud.verticalAlignment='top';this.hud.margin='8 28 0';this.hud.columns='*,48,48,48';
    const headings=new StackLayout();headings.addChild(this.title);headings.addChild(this.room);headings.isUserInteractionEnabled=false;this.hud.addChild(headings);
    this.undo=button('↶','undo',()=>this.session?.undo());this.undo.accessibilityLabel='撤销';GridLayout.setColumn(this.undo,1);this.hud.addChild(this.undo);
    this.exit=button('↗','exit-level',()=>{this.releaseStick();this.session?.exit();});this.exit.accessibilityLabel='退出当前关卡';GridLayout.setColumn(this.exit,2);this.hud.addChild(this.exit);
    const menuButton=button('☰','menu',()=>void this.openMenu());menuButton.accessibilityLabel='旅程菜单';GridLayout.setColumn(menuButton,3);this.hud.addChild(menuButton);root.addChild(this.hud);
    // Let Android deliver each pointer to its own control while the stick is held.
    this.controls.on('loaded',()=>{let view=this.controls.nativeViewProtected as android.view.View;while(view instanceof android.view.ViewGroup){view.setMotionEventSplittingEnabled(true);view=view.getParent() as unknown as android.view.View;}});
    this.controls.height=170;this.controls.verticalAlignment='bottom';this.controls.margin='0 30 10';this.controls.columns='150,*,180';
    this.stick.width=146;this.stick.height=146;this.stick.borderRadius=73;this.stick.borderWidth=1;this.stick.borderColor=new Color(153,134,164,152);this.stick.backgroundColor=new Color(85,87,123,112);this.stick.opacity=.68;this.stick.accessibilityLabel='移动摇杆';this.stick.id='joystick';
    const marks=new GridLayout();marks.width=126;marks.height=126;marks.rows='*,*,*';marks.columns='*,*,*';marks.isUserInteractionEnabled=false;
    for(const [text,row,column] of [['↑',0,1],['←',1,0],['→',1,2],['↓',2,1]] as const){const mark=label(text,18);mark.textAlignment='center';mark.verticalAlignment='middle';mark.color=new Color(200,54,89,79);GridLayout.setRow(mark,row);GridLayout.setColumn(mark,column);marks.addChild(mark);}this.stick.addChild(marks);
    this.thumb.width=58;this.thumb.height=58;this.thumb.borderRadius=29;this.thumb.backgroundColor=new Color(213,247,244,221);this.thumb.borderWidth=2;this.thumb.borderColor=new Color(136,255,255,255);this.thumb.isUserInteractionEnabled=false;this.stick.addChild(this.thumb);this.controls.addChild(this.stick);
    this.stick.on('touch',(event:EventData)=>{const e=event as TouchGestureEventData;if(!this.session||this.session.home||this.busy)return;
      if(e.action==='up'||e.action==='cancel'){this.releaseStick();return;}this.audio?.schedule([]);
      const x=e.getX()-73,y=e.getY()-73,v=stickThumb(x,y);this.thumb.translateX=v.x;this.thumb.translateY=v.y;this.session.setDirection(stickDirection(x,y,this.session.held));
    });
    const actions=new AbsoluteLayout();GridLayout.setColumn(actions,2);this.controls.addChild(actions);
    this.jump=button('↑\n跳跃','jump',()=>this.session?.jump());this.jump.width=78;this.jump.height=78;this.jump.borderRadius=39;this.jump.fontSize=17;this.jump.backgroundColor=new Color(218,245,228,183);AbsoluteLayout.setLeft(this.jump,92);AbsoluteLayout.setTop(this.jump,5);actions.addChild(this.jump);
    this.dive=button('↓\n下钻','dive',()=>this.session?.act({type:'dive'}));this.dive.width=68;this.dive.height=68;this.dive.borderRadius=34;this.dive.fontSize=15;this.dive.backgroundColor=new Color(218,203,229,227);AbsoluteLayout.setLeft(this.dive,17);AbsoluteLayout.setTop(this.dive,87);actions.addChild(this.dive);root.addChild(this.controls);
    this.toast.horizontalAlignment='center';this.toast.verticalAlignment='bottom';this.toast.marginBottom=10;this.toast.maxWidth=370;this.toast.textWrap=true;this.toast.textAlignment='center';this.toast.isUserInteractionEnabled=false;root.addChild(this.toast);
    this.menu.backgroundColor=new Color(204,238,240,223);const panel=new StackLayout();panel.width=340;panel.padding=15;panel.borderRadius=20;panel.backgroundColor=new Color(245,255,247,232);panel.horizontalAlignment='center';panel.verticalAlignment='middle';
    this.menuTitle.textAlignment='center';this.menuTitle.fontWeight='bold';panel.addChild(this.menuTitle);this.menuInfo.textAlignment='center';this.menuInfo.marginBottom=10;panel.addChild(this.menuInfo);
    this.slots.height=48;this.slots.columns='*,*,*,*,*';for(let n=1;n<=5;n++){const b=button(String(n),`slot-${n}`,()=>{this.slot=n;this.paint();});b.margin=2;GridLayout.setColumn(b,n-1);this.slots.addChild(b);}panel.addChild(this.slots);
    this.continueButton=button('继续旅程','continue',()=>void this.start(false));this.continueButton.marginTop=8;this.continueButton.backgroundColor=new Color('#c7e0c7');panel.addChild(this.continueButton);
    const row=new GridLayout();row.height=44;row.columns='*,*';const fresh=button('新的旅程','new',()=>void this.start(true));const help=button('玩法说明','help',()=>void this.help());GridLayout.setColumn(help,1);row.addChild(fresh);row.addChild(help);row.marginTop=8;panel.addChild(row);
    const more=new GridLayout();more.height=44;more.columns='*,*';const reset=button('重玩当前关卡','reset',()=>void this.reset());const sound=button(!this.smoke&&this.storage.getItem('boxbound-muted')==='true'?'音效 关':'音效 开','sound',()=>{if(this.audio){this.audio.muted=!this.audio.muted;if(this.audio.muted)this.audio.stop();sound.text=this.audio.muted?'音效 关':'音效 开';if(!this.smoke)this.storage.setItem('boxbound-muted',String(this.audio.muted));}});GridLayout.setColumn(sound,1);more.addChild(reset);more.addChild(sound);more.marginTop=8;panel.addChild(more);this.menu.addChild(panel);root.addChild(this.menu);
    this.status.horizontalAlignment='center';this.status.verticalAlignment='middle';root.addChild(this.status);
    this.canvas.on('ready',this.attach);Application.android.on('activityBackPressed',this.back);this.paint();
  }
  private readonly attach=()=>{if(this.host||this.disposed)return;
    this.host=new NativeRenderHost(this.canvas,text=>{if(text.startsWith('原生 WebGPU 已呈现'))this.status.visibility='collapse';else{this.status.text=text;this.status.visibility='visible';if(text.includes('失败'))this.page.splash.fail(text);}}, {
      engineOptions:{renderProfile:'batched',msaaSamples:4,clearColor:{r:.9294,g:.9412,b:.8745,a:1}},diagnosticName:'boxbound',diagnosticIntervalFrames:0,capture:{requested:this.smoke,file:'boxbound-frame.png'},
      prepareScene:async engine=>{
        this.engine=engine;
        const base=path.join(knownFolders.currentApp().path,'game/levels/index.json');installWorldMap(await loadWorldMap(new URL('file://'+base),async url=>JSON.parse(await File.fromPath(decodeURIComponent(url.pathname)).readText())));
        this.saves=new BoxboundSaves(new LocalStorageSaveBackend({namespace:this.smoke?'boxbound-native-smoke':'haiyue-games',storage:new NativeSettingsStorage()}));
        this.session=new MobileSession();const canvas=this.canvas;
        this.scene=new BoxboundScene(engine,{get width(){return engine.width;},get height(){return engine.height;},get clientWidth(){return canvas.getActualSize().width;},get clientHeight(){return canvas.getActualSize().height;},style:{opacity:'1'}},new NativeLabels(this.labels));
        this.session.scene=this.scene;this.session.changed=()=>this.paint();this.session.save=state=>{const slot=this.slot;void this.saves!.save(slot,state).catch(e=>{this.toast.text='保存失败，请稍后重试。';console.error(e);});};
        this.audio=new MobileAudio();if(!this.smoke)this.audio.muted=this.storage.getItem('boxbound-muted')==='true';void this.audio.load();this.session.audio=cues=>this.audio?.schedule(cues);
        this.summaries=await this.saves.summaries();this.scene.show(this.session.state);this.ready=true;this.status.visibility='collapse';engine.on('update',this.tick);engine.on('after-update',this.presented);this.paint();return this.snapshot();
      },
      bindInput:(_engine,report)=>{
        if(this.smoke)setTimeout(()=>void runSmoke(this,report),1500);
        return{suspend:()=>{this.releaseStick();if(this.session)this.session.paused=true;this.audio?.stop();void this.saves?.service.flush();},resume:()=>{if(this.session)this.session.paused=false;},dispose:()=>this.releaseStick(),snapshot:()=>this.snapshot()};
      },disposeScene:()=>{this.engine?.off('update',this.tick);this.engine?.off('after-update',this.presented);this.scene?.dispose();this.audio?.dispose();}
    });
  };
  private readonly tick=()=>{this.session?.tick(performance.now());this.audio?.tick();};
  private readonly presented=()=>{if(!this.shown){this.shown=true;this.page.splash.presented();}};
  releaseStick(){this.session?.setDirection(null);this.thumb.translateX=0;this.thumb.translateY=0;}
  paint(){const s=this.session,playing=!!s&&!s.home;this.hud.visibility=playing?'visible':'collapse';this.controls.visibility=playing?'visible':'collapse';this.toast.visibility=playing?'visible':'collapse';this.menu.visibility=playing?'collapse':'visible';this.continueButton.isEnabled=this.ready&&!this.busy&&(this.summaries.some(x=>x.saveId===`journey-${this.slot}`)||!!s&&!s.home);
    if(s){const room=s.state.rooms[s.state.player.room]!;this.room.text=`${room.name}  ·  ${s.state.completed.length}/${levelIds(s.state).length}  ·  ${s.state.moves} 步`;this.toast.text=s.state.message;this.undo.isEnabled=!!s.history.length;this.exit.isEnabled=!!s.state.player.route.length;}
    for(let i=0;i<5;i++){const b=this.slots.getChildAt(i) as Button;b.backgroundColor=new Color(this.slot===i+1?'#aacfc0':'#f3f1df');b.text=`${i+1}${this.summaries.some(v=>v.saveId===`journey-${i+1}`)?' ·':''}`;}
  }
  async start(fresh:boolean){if(!this.ready||this.busy||!this.session||!this.saves)return;this.busy=true;this.paint();try{
      if(fresh&&!this.smoke&&this.summaries.some(x=>x.saveId===`journey-${this.slot}`)&&!await confirm({title:'重新开始旅程？',message:'这会替换当前所选存档，其他旅程不受影响。',okButtonText:'重新开始',cancelButtonText:'保留存档'}))return;
      await this.saves.service.flush();const state=fresh?createGame():await this.saves.load(this.slot)??createGame();this.session.load(state);await this.saves.save(this.slot,state);
    }catch(e){await alert({title:'无法打开旅程',message:String(e),okButtonText:'知道了'});}finally{this.busy=false;this.paint();}}
  async openMenu(){if(!this.session||this.busy)return;this.releaseStick();this.session.cancel();this.session.home=true;this.audio?.stop();this.paint();await this.saves?.service.flush();this.summaries=await this.saves!.summaries();this.paint();}
  async help(){this.releaseStick();const release=this.host?.pausePresentation();try{await alert({title:'箱庭迷境 · 玩法',message:'左侧摇杆控制移动和推箱；按住摇杆可连续移动。\n右侧跳跃：单按原地跳跃，配合摇杆登上台阶或盒顶。\n下钻：从盒顶进入，或进入面前的盒子。\n右上角撤销一步；退出可直接回到当前关卡外层。\n将箱子推到对应颜色的方框，再站到笑脸终点。Parabox 平面关不能跳过箱子。\n每一步自动保存，五段旅程互相独立。',okButtonText:'开始探索'});}finally{release?.();}}
  async reset(){if(!this.session?.state.rooms[this.session.state.player.room]?.level){await alert({title:'重玩关卡',message:'进入一个关卡后可以重玩。',okButtonText:'知道了'});return;}if(await confirm({title:'重玩当前关卡？',message:'重置当前关卡内的箱子，保留通关记录。',okButtonText:'重玩',cancelButtonText:'返回'})){this.session.home=false;this.session.reset();this.paint();}}
  private readonly back=(e:EventData&{cancel?:boolean})=>{e.cancel=true;if(!this.session)return;if(this.session.home){if(this.ready)void this.start(false);}else if(this.session.state.player.route.length)this.session.exit();else void this.openMenu();};
  snapshot(){return{title:'箱庭迷境',ready:this.ready,smoke:this.smoke,home:this.session?.home,slot:this.slot,room:this.session?.state.player.room,moves:this.session?.state.moves,completed:this.session?.state.completed,viewport:this.canvas.getActualSize(),stick:this.stick.getActualSize(),jump:this.jump.getActualSize(),dive:this.dive.getActualSize(),held:this.session?.held,undo:this.session?.history.length,splash:this.page.splash.status};}
  dispose(){if(this.disposed)return;this.disposed=true;Application.android.off('activityBackPressed',this.back);this.canvas.off('ready',this.attach);this.releaseStick();void this.saves?.service.flush();this.host?.dispose();this.page.splash.dispose();}
}
