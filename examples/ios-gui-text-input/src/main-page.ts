import {Application,File,knownFolders,path,Page,Label,Device,type EventData} from '@nativescript/core';
import type {Canvas} from '@nativescript/canvas';
import {Entity} from '@haiyue/engine';
import {GuiRoot,GuiInput,GuiLabel,GuiScrollView,GuiButton,GuiElement,type GuiSystem} from '@haiyue/engine/gui';
import {NativeRenderHost} from '../../../bridge/lifecycle/host';
import type {NativeCanvasInput} from '../../../bridge/render/surface';
import {NativeTouchInput} from '../../../bridge/input/native-touch.ios';
import {NativeGuiTextInputHost} from '../../../bridge/input/text-input.ios';
import {NativeCanvasTextures} from '../../../bridge/render/canvas-textures.ios';
import {readCandidateIdentity} from './candidate';

let host:NativeRenderHost|null=null,activeCanvas:Canvas|null=null;
const ready=new WeakSet<Canvas>();
export function onCanvasReady(args:EventData):void {const canvas=args.object as Canvas;ready.add(canvas);start(canvas);}
export function onLoaded(args:EventData):void {const canvas=(args.object as Page).getViewById<Canvas>('surface');if(canvas&&ready.has(canvas))start(canvas);}
export function onUnloaded():void {if(!Application.inBackground&&!Application.suspended)dispose();}
function start(canvas:Canvas):void {
  if(host&&activeCanvas!==canvas)dispose();if(host)return;activeCanvas=canvas;
  let gui:GuiSystem|null=null,root:GuiRoot|null=null,textures:NativeCanvasTextures|null=null,offInvalidation:(()=>void)|null=null;
  const fields:GuiInput[]=[],journal:string[]=[];
  const log=File.fromPath(path.join(knownFolders.documents().path,'g06-text-input.jsonl'));
  const snapshot=()=>({focus:gui?.focus.focused?.id??null,fields:fields.map(input=>({id:input.id,value:input.inputType==='password'?'[redacted]':input.value,selection:[input.selectionAnchor,input.selectionFocus],composing:input.isComposing,rect:{...input.rect}}))});
  const record=(event:string,detail:unknown)=>{
    const row=JSON.stringify({time:new Date().toISOString(),event,detail,state:snapshot()});journal.push(row);if(journal.length>5000)journal.splice(1,1);
    console.log('[G06] '+row);log.writeTextSync(journal.join('\n')+'\n');
  };
  const bridge=new NativeGuiTextInputHost(canvas.nativeViewProtected as UIView,record);
  const touch=new NativeTouchInput(canvas,()=>host?.requestFrame());
  const input:NativeCanvasInput={addEventListener:touch.target.addEventListener.bind(touch.target),removeEventListener:touch.target.removeEventListener.bind(touch.target),setPointerCapture:touch.target.setPointerCapture.bind(touch.target),releasePointerCapture:touch.target.releasePointerCapture.bind(touch.target)} as unknown as NativeCanvasInput;
  const status=(text:string)=>{const label=(canvas.page as Page).getViewById<Label>('status');if(label)label.text=text;};
  host=new NativeRenderHost(canvas,status,{
    diagnosticName:'g06',enginePackageVersion:'0.2.1 + G06 candidate (see qualified-candidate.json)',canvasInput:input,diagnosticIntervalFrames:0,
    needsAnimationFrame:()=>gui?.animating??false,
    prepareScene(engine){
      const candidate=readCandidateIdentity(File.fromPath(path.join(knownFolders.currentApp().path,'qualified-candidate.json')).readTextSync());
      record('candidate',{candidateId:candidate.candidateId,enginePackage:candidate.enginePackage});
      textures=new NativeCanvasTextures(engine.device);
      const readAtlasPixels=(canvas:HTMLCanvasElement)=>{
        const pixels=textures!.readAtlasPixels(canvas);let coloredPixels=0;
        for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]!>0&&(pixels[i]!==pixels[i+1]||pixels[i+1]!==pixels[i+2]))coloredPixels++;
        record('font-atlas',{width:canvas.width,height:canvas.height,coloredPixels});return pixels;
      };
      const scene=engine.createScene({name:'G06 native text input',render3D:false,render2D:false,gui:{loadOp:'clear',textInputHost:{open:request=>bridge.open({...request,onViewportInset:inset=>request.onViewportInset({...inset,top:Math.max(144,inset.top)})})},font:{canvasFactory:textures.createCanvas2D,readAtlasPixels,fontFamily:'sans-serif',chars:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 中文你好取消提交A😀Bé👩🏽‍💻•/():;,.?!-_|'}}});
      gui=scene.guiSystem!;root=new GuiRoot({theme:{fontSize:18}});
      const scroll=root.add(new GuiScrollView({width:'100%',height:'100%',contentHeight:1390,focus:{mode:'none'}}));
      scroll.add(new GuiLabel({x:20,y:160,width:'90%',height:50,fontSize:22,text:'G06 native text / IME'}));
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
      scroll.add(new GuiButton({x:20,y:1300,width:'88%',height:40,text:'End and save cleanup evidence',onClick:()=>{record('human-end',bridge.snapshot());setTimeout(()=>{dispose();status('G06 closed. Export the two JSONL files.');},0);}}));
      scene.add(new Entity('g06-ui').addComponent(root));engine.switchScene(scene);
      offInvalidation=root.onInvalidation(()=>host?.requestFrame());
      record('environment',{model:Device.model,os:Device.os,osVersion:Device.osVersion,canvas:'2.1.18',nativeRuntime:'9.0.3',qualification:'Human device evidence pending; checkpoints alone do not assert success.'});
      return {scene:'G06',log:log.path};
    },
    bindInput:()=>({suspend(){bridge.suspend();touch.suspend();gui?.stopAnimations();record('input-suspended',bridge.snapshot());},resume(){bridge.resume();touch.resume();record('input-resumed',bridge.snapshot());},snapshot:()=>({text:bridge.snapshot(),touch:touch.snapshot()}),dispose(){bridge.dispose();touch.dispose();record('input-disposed',bridge.snapshot());}}),
    disposeScene(){offInvalidation?.();offInvalidation=null;textures?.dispose();textures=null;gui=null;root=null;},
  });
  Application.on(Application.exitEvent,dispose);
}
function dispose():void {Application.off(Application.exitEvent,dispose);host?.dispose();host=null;activeCanvas=null;}
