import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=(file,dependencies={})=>{
  const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};new Function('require','module','exports',source)(name=>{if(!(name in dependencies))throw new Error(name);return dependencies[name];},module,module.exports);return module.exports;
};
const core={Screen:{mainScreen:{scale:3}},isAndroid:true};
const android=load('../../../bridge/render/view-rect.android.ts',{'@nativescript/core':core});
const ios=load('../../../bridge/render/view-rect.ios.ts');
const {NativeSurface}=load('../../../bridge/render/surface.ts',{
  '@nativescript/core':core,'@nativescript/canvas':{GPU:class {}},'./view-rect':android,
  './device-descriptor':{},'./webgpu-constants':{installNativeWebGpuConstants(){}},'./queue-fence':{},
});
test('dimensions are read once per frame without window coordinates; layout/resume refresh and touch bounds stay live',()=>{
  let width=2400,height=1080,left=0,top=0,sizeReads=0,originReads=0;
  const view={nativeViewProtected:{getWidth(){sizeReads++;return width;},getHeight(){sizeReads++;return height;}},getLocationInWindow(){originReads++;return {x:left,y:top};}};
  const previous=Object.getOwnPropertyDescriptor(globalThis.navigator,'gpu');
  const surface=new NativeSurface(view,()=>{}),canvas=surface.engineOptions().canvas;
  try {
    assert.equal(surface.hasLayout,true);
    for(let i=0;i<120;i++){assert.equal(canvas.clientWidth,800);assert.equal(canvas.clientHeight,360);}
    assert.equal(sizeReads,2);assert.equal(originReads,0);
    surface.present();assert.equal(canvas.clientWidth,800);assert.equal(sizeReads,4);
    width=1080;height=2400;assert.equal(surface.hasLayout,true);assert.equal(canvas.clientHeight,800);
    assert.equal(sizeReads,6,'layout refreshes dimensions while no frame is running');
    left=20;top=59;const rect=canvas.getBoundingClientRect();assert.equal(rect.right,380);assert.equal(rect.top,59);
    left=40;assert.equal(canvas.getBoundingClientRect().left,40,'window position is not cached');
    assert.equal(originReads,2);
    surface.release();width=1200;assert.equal(canvas.clientWidth,400);
  } finally {if(previous)Object.defineProperty(globalThis.navigator,'gpu',previous);else delete globalThis.navigator.gpu;}
});
test('iOS size keeps full UIKit drawing bounds and does not request window origin',()=>{
  const view={clientWidth:814,clientHeight:361,nativeViewProtected:{bounds:{size:{width:932,height:430}}},getLocationInWindow(){throw new Error('size query requested window coordinates');}};
  assert.deepEqual(ios.nativeViewSize(view),{width:932,height:430});
});
