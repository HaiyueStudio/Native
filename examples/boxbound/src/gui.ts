import {Entity,type HaiyueEngine} from '@haiyue/engine';
import {GuiRoot,GuiElement,GuiLabel,GuiButton,GuiImage,GuiSystem,type GuiRect} from '@haiyue/engine/gui';
import {ImageAsset} from '@nativescript/canvas';
import {knownFolders,path} from '@nativescript/core';
import {NativeCanvasTextures} from '../../../bridge/render/canvas-textures';
import type {BoxboundLabels,BoxboundLabel} from '../../../../Games/games/boxbound/labels';
import type {State} from '../../../../Games/games/boxbound/model';
import type {VirtualJoystickState} from '@haiyue/extensions/controls';
import {resolvePixelRatio,type QualitySettings,type PixelRatioChoice} from '../../../../Games/games/boxbound/quality';
import {FONT_CHARS} from './font-chars';
export const rects=(w:number,h:number)=>({jump:{x:w-108,y:h-176,width:78,height:78},dive:{x:w-184,y:h-94,width:68,height:68}});
function place(node:GuiElement,rect:(r:GuiRect)=>GuiRect){node.layout=r=>{node.rect=rect(r);for(const child of node.children)child.layout(node.rect);};}
function positioned(node:GuiElement,rect:GuiRect){const old=node.rect;if(old.x!==rect.x||old.y!==rect.y||old.width!==rect.width||old.height!==rect.height){node.rect=rect;node.markDirty();}node.layout=()=>{};}
export interface GuiActions {undo():void;exit():void;jump():void;dive():void;menu():void;start(fresh:boolean):void;slot(n:number):void;help():void;reset():void;sound():void;settings():void;closeSettings():void;quality(value:QualitySettings):void;}
/** Native host supplies pixels and events; every game HUD/control/menu is Engine GUI. */
export class MobileGui {
 readonly root=new GuiRoot({theme:{fontFamily:'sans-serif',fontSize:14,radius:14,colors:{text:'#34594f',textMuted:'#72867b',background:'#f4f3df',surface:'#f8f3e3',primary:'#cbdcc2',danger:'#df9b89',border:'#9cb7a0',hover:'#e3e9ce',active:'#b7ccaf',disabled:'#a8afa2'}}});
 readonly entity=new Entity('Boxbound Engine GUI').addComponent(this.root);
 readonly labels=new GuiElement({id:'map-labels',width:'100%',height:'100%',disabled:true});
 readonly hud=new GuiElement({id:'hud',width:'100%',height:'100%'});
 readonly menu=new GuiElement({id:'menu',width:'100%',height:'100%',style:{backgroundColor:'#eef0dfcc'}});
 readonly title=new GuiLabel({text:'箱庭迷境',fontSize:21});
 readonly room=new GuiLabel({text:'',fontSize:12});
 readonly toast=new GuiLabel({text:'',fontSize:12,textAlign:'center'});
 readonly stickBase=new GuiImage({id:'joystick-base',disabled:true,visible:false,tint:'#ffffff80',uv:[.065,.065,.935,.935]});
 readonly stickThumb=new GuiImage({id:'joystick-thumb',disabled:true,visible:false,tint:'#ffffff80',uv:[.23,.23,.77,.77]});
 readonly jump:GuiButton;readonly dive:GuiButton;readonly undo:GuiButton;readonly exit:GuiButton;
 readonly continueButton:GuiButton;readonly slotButtons:GuiButton[]=[];readonly sound:GuiButton;
 readonly settingsButton:GuiButton;
 readonly settingsPanel=new GuiElement({id:'quality-settings',width:'100%',height:'100%',visible:false,style:{backgroundColor:'#eef0dfee'}});
 readonly msaaButton:GuiButton;readonly ratioButtons:GuiButton[]=[];readonly closeSettingsButton:GuiButton;
 private readonly ratioInfo:GuiLabel;
 private readonly iconNodes=new Map<string,GuiImage>();
 private quality:QualitySettings={msaa:true,pixelRatio:'auto'};private settingsOpen=false;
 readonly system:GuiSystem;
 private readonly textures:NativeCanvasTextures;
 private readonly mapLabels=new Set<GuiLabel>();
 private readonly slotStyles=['#f3f1df','#aacfc0'];
 private readonly levelCount:number;
 private slotShown=0;private playing=false;
 constructor(engine:HaiyueEngine,state:State,actions:GuiActions){
  this.levelCount=new Set(Object.values(state.rooms).filter(r=>r.level>0).map(r=>r.level)).size;
  this.textures=new NativeCanvasTextures(engine.device);
  const chars=[...new Set(FONT_CHARS+'画质设置抗锯齿开启关闭自动分辨率倍率设备默认上限应用保存返回恢复跟随机型，×'+Object.values(state.rooms).map(r=>r.name+r.hint+(r.exitLabel??'')).join(''))].join('');
  this.system=new GuiSystem(engine,{loadOp:'load',font:{canvasFactory:this.textures.createCanvas2D,readAtlasPixels:this.textures.readAtlasPixels,chars,fontSize:32,atlasSize:2048,fontFamily:'sans-serif'}});
  this.root.add(this.labels);this.root.add(this.hud);this.hud.add(this.title);this.hud.add(this.room);
  place(this.title,()=>({x:28,y:12,width:260,height:28}));place(this.room,r=>({x:28,y:42,width:r.width-272,height:22}));
  const button=(parent:GuiElement,text:string,id:string,action:()=>void,down=false)=>parent.add(new GuiButton({id,text,...(down?{onPointerDown:action}:{onClick:action}),style:{backgroundColor:'#f8f3e3e8',borderColor:'#a6b699',radius:16}}));
  const iconButton=(parent:GuiElement,name:string,id:string,action:()=>void,down=false)=>{
   const b=button(parent,'',id,action,down);b.setStyle({backgroundColor:'#00000000',hoverBackgroundColor:'#00000000',borderColor:'#00000000',radius:0});
   const icon=b.add(new GuiImage({id:`icon-${name}`,disabled:true}));place(icon,r=>({...r}));this.iconNodes.set(name,icon);return b;
  };
  this.undo=iconButton(this.hud,'undo','undo',actions.undo);this.exit=iconButton(this.hud,'exit','exit-level',actions.exit);
  const menu=iconButton(this.hud,'menu','open-menu',actions.menu);
  [this.undo,this.exit,menu].forEach((b,i)=>place(b,r=>({x:r.width-228+i*50,y:12,width:46,height:44})));
  this.jump=iconButton(this.hud,'jump','jump',actions.jump,true);place(this.jump,r=>rects(r.width,r.height).jump);
  this.dive=iconButton(this.hud,'dive','dive',actions.dive,true);place(this.dive,r=>rects(r.width,r.height).dive);
  this.hud.add(this.toast);place(this.toast,r=>({x:r.width*.2,y:r.height-36,width:r.width*.6,height:24}));
  this.root.add(this.stickBase);this.root.add(this.stickThumb);
  this.root.add(this.menu);const panel=this.menu.add(new GuiElement({style:{backgroundColor:'#fff7e8f5',radius:22}}));place(panel,r=>({x:(r.width-344)/2,y:(r.height-296)/2,width:344,height:296}));
  panel.add(new GuiLabel({text:'箱庭迷境',x:20,y:14,width:304,height:38,fontSize:28,textAlign:'center'}));panel.add(new GuiLabel({text:'每个盒子里，都藏着一个世界。',x:10,y:54,width:324,height:24,fontSize:13,textAlign:'center'}));
  for(let n=1;n<=5;n++){const b=button(panel,String(n),`slot-${n}`,()=>actions.slot(n));place(b,r=>({x:r.x+18+(n-1)*62,y:r.y+89,width:58,height:40}));this.slotButtons.push(b);}
  this.continueButton=button(panel,'继续旅程','continue',()=>actions.start(false));place(this.continueButton,r=>({x:r.x+18,y:r.y+139,width:308,height:42}));this.continueButton.setStyle({backgroundColor:'#c7e0c7'});
  const buttons=[button(panel,'新的旅程','new',()=>actions.start(true)),button(panel,'玩法说明','help',actions.help),button(panel,'重玩当前关卡','reset',actions.reset),this.sound=button(panel,'音效 开','sound',actions.sound)];
  buttons.forEach((b,i)=>place(b,r=>({x:r.x+18+(i%2)*158,y:r.y+191+Math.floor(i/2)*46,width:150,height:38})));
  this.settingsButton=iconButton(this.root.root,'settings','open-settings',actions.settings);
  place(this.settingsButton,r=>({x:r.width-78,y:12,width:46,height:44}));
  this.root.add(this.settingsPanel);
  const qualityPanel=this.settingsPanel.add(new GuiElement({style:{backgroundColor:'#fff7e8',radius:22}}));
  place(qualityPanel,r=>({x:(r.width-360)/2,y:(r.height-292)/2,width:360,height:292}));
  qualityPanel.add(new GuiLabel({text:'画质设置',x:20,y:16,width:320,height:34,fontSize:23,textAlign:'center'}));
  this.msaaButton=button(qualityPanel,'', 'quality-msaa',()=>actions.quality({...this.quality,msaa:!this.quality.msaa}));
  place(this.msaaButton,r=>({x:r.x+22,y:r.y+62,width:316,height:42}));
  this.ratioInfo=qualityPanel.add(new GuiLabel({text:'',x:22,y:117,width:316,height:24,fontSize:12,textAlign:'center'}));
  (['auto',1,1.5,2,3] as PixelRatioChoice[]).forEach((choice,i)=>{
   const b=button(qualityPanel,choice==='auto'?'自动':`${choice}×`,`quality-ratio-${choice}`,()=>actions.quality({...this.quality,pixelRatio:choice}));
   place(b,r=>({x:r.x+22+i*64,y:r.y+151,width:60,height:38}));this.ratioButtons.push(b);
  });
  qualityPanel.add(new GuiLabel({text:'自动倍率跟随机型，默认上限 2×',x:22,y:199,width:316,height:23,fontSize:12,textAlign:'center'}));
  this.closeSettingsButton=button(qualityPanel,'返回','close-settings',actions.closeSettings);
  place(this.closeSettingsButton,r=>({x:r.x+22,y:r.y+236,width:316,height:38}));

 }
 async loadTextures(){for(const [name,node] of [['joystick-base',this.stickBase],['joystick-thumb',this.stickThumb],...this.iconNodes] as [string,GuiImage][]){const image=new ImageAsset();await image.fromFile(path.join(knownFolders.currentApp().path,'assets/ui',name+'.png'));if(image.error)throw Error(image.error);const canvas=this.textures.createCanvas2D(256,256);canvas.getContext('2d')!.drawImage(image as unknown as CanvasImageSource,0,0,256,256);node.setSource(this.textures.textureFromCanvas(canvas,name));}}
 readonly labelPort:BoxboundLabels={
  get count(){return 0;}, // replaced by the accessor below
  create:():BoxboundLabel=>{const node=this.labels.add(new GuiLabel({fontSize:9,textAlign:'center',style:{color:'#34564c',backgroundColor:'#fff7e6e8',radius:4,padding:4}}));this.mapLabels.add(node);
   return{text:(text,complete)=>{node.setText(text);node.setStyle({color:complete?'#168768':'#34564c'});},project:(x,y,visible)=>{node.setVisible(visible);const width=Math.max(30,[...node.text].reduce((n,c)=>n+(c.charCodeAt(0)>255?9:5.5),0)+10);positioned(node,{x:Math.max(0,x-width/2),y:Math.max(0,y-10),width,height:18});},remove:()=>{this.labels.remove(node);this.mapLabels.delete(node);}};
  },opacity:(value:number)=>this.labels.setStyle({opacity:value}),clear:()=>{for(const node of this.mapLabels)this.labels.remove(node);this.mapLabels.clear();}
 };
 labelsPort(){Object.defineProperty(this.labelPort,'count',{get:()=>this.mapLabels.size,configurable:true});return this.labelPort;}
 update(state:State,playing:boolean,slot:number,slots:Set<number>,undo:boolean,busy:boolean,muted:boolean,quality:QualitySettings,settingsOpen:boolean,deviceRatio:number){
  this.playing=playing&&!settingsOpen;this.settingsOpen=settingsOpen;this.quality=quality;
  this.hud.setVisible(playing&&!settingsOpen);this.labels.setVisible(playing&&!settingsOpen);this.menu.setVisible(!playing&&!settingsOpen);
  this.settingsPanel.setVisible(settingsOpen);this.settingsButton.setVisible(!settingsOpen);
  this.msaaButton.setText(`抗锯齿 MSAA  ${quality.msaa?'开启 4×':'关闭'}`);
  this.ratioInfo.setText(`分辨率倍率 ${resolvePixelRatio(quality.pixelRatio,deviceRatio)}× · 设备 ${deviceRatio}×`);
  (['auto',1,1.5,2,3] as const).forEach((v,i)=>this.ratioButtons[i]!.setStyle({backgroundColor:quality.pixelRatio===v?'#aacfc0':'#f3f1df'}));
  this.room.setText(`${state.rooms[state.player.room]!.name} · ${state.completed.length}/${this.levelCount}`);this.toast.setText(state.message);
  this.iconNodes.get('undo')!.setTint(undo?'#ffffffff':'#ffffff60');this.iconNodes.get('exit')!.setTint(state.player.route.length?'#ffffffff':'#ffffff60');
  this.undo.setDisabled(!undo);this.exit.setDisabled(!state.player.route.length);this.continueButton.setDisabled(busy||!slots.has(slot));
  if(!playing){this.sound.setText(muted?'音效 关':'音效 开');for(let i=0;i<5;i++){const b=this.slotButtons[i]!;if(this.slotShown!==slot)b.setStyle({backgroundColor:this.slotStyles[slot===i+1?1:0]});b.setText(`${i+1}${slots.has(i+1)?' ·':''}`);}this.slotShown=slot;}
 }
 updateStick(state:VirtualJoystickState){const visible=state.active&&this.playing;this.stickBase.setVisible(visible);this.stickThumb.setVisible(visible);if(visible){positioned(this.stickBase,{x:state.center.x-73,y:state.center.y-73,width:146,height:146});positioned(this.stickThumb,{x:state.center.x+state.offset.x-29,y:state.center.y+state.offset.y-29,width:58,height:58});}}
 ownsPoint(x:number,y:number){const hit=this.root.hitTest(x,y);return hit instanceof GuiButton||!this.playing||this.settingsOpen;}
 dispose(){this.labelPort.clear();this.textures.dispose();}
}
