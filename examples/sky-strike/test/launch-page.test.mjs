import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('Sky Strike uses the shared launch page and dismisses only after a GPU present', async()=>{
  const events=new Map(),hosts=[];
  class Canvas {listeners=new Map();on(event,callback){this.listeners.set(event,callback);}}
  class NativeEngineLaunchPage {
    listeners=new Map();splash={status:'loading',setMessage(message){this.message=message;},presented(){this.status='hidden';},fail(message){this.status='failed';this.message=message;},dispose(){this.status='disposed';}};
    gameRoot={addChild:canvas=>{this.canvas=canvas;canvas.page=this;}};
    constructor(options){this.options=options;}
    on(event,callback){this.listeners.set(event,callback);}
    getViewById(id){return this.canvas.id===id?this.canvas:null;}
  }
  const injected={Canvas,NativeEngineLaunchPage,
    SkyStrikeLocale:class{text(key){return `localized:${key}`;}},NativeSettingsStorage:class{},
    NativeTouchInput:class{target={addEventListener(){},removeEventListener(){},releasePointerCapture(){}};},NativeHaptics:class{},
    NativeRenderHost:class{constructor(canvas,status,options){Object.assign(this,{canvas,status,options});hosts.push(this);}dispose(){this.disposed=true;}},
    NSProcessInfo:{processInfo:{environment:{objectForKey(){return '0';}}}},
    Application:{inBackground:false,suspended:false,uncaughtErrorEvent:'error',exitEvent:'exit',on(k,v){events.set(k,v);},off(k){events.delete(k);}},
  };
  const compiled=ts.transpileModule(readFileSync(new URL('../src/main-page.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\r?\n/gm,'');
  globalThis.__skyLaunchTest=injected;
  try{
    const source=`const {${Object.keys(injected).join(',')}}=globalThis.__skyLaunchTest;\n${compiled}`;
    const module=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const page=module.createLaunchPage();assert.ok(page instanceof NativeEngineLaunchPage);
    assert.equal(page.options.orientation,'portrait');assert.equal(page.options.message,'localized:preparing');
    assert.equal(page.gameRoot.iosOverflowSafeArea,true);assert.equal(page.canvas.ignoreTouchEvents,true);
    page.listeners.get('loaded')({object:page});assert.equal(hosts.length,0);
    page.canvas.listeners.get('ready')({object:page.canvas});assert.equal(hosts.length,1);
    page.listeners.get('loaded')({object:page});assert.equal(hosts.length,1);
    hosts[0].status('正在初始化原生 WebGPU…');assert.equal(page.splash.status,'loading');
    hosts[0].status('原生 WebGPU 已呈现 1 帧');assert.equal(page.splash.status,'hidden');
    hosts[0].status('初始化或渲染失败');assert.equal(page.splash.status,'failed');assert.equal(page.splash.message,'localized:startupFailed');
    injected.Application.inBackground=true;page.listeners.get('unloaded')();assert.equal(hosts[0].disposed,undefined);
    injected.Application.inBackground=false;page.listeners.get('unloaded')();assert.equal(hosts[0].disposed,true);assert.equal(page.splash.status,'disposed');assert.equal(events.size,0);
  }finally{delete globalThis.__skyLaunchTest;}
});
