import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('native readback canvases request CPU rasterization before any drawing and reuse GPU uploads',()=>{
 const created=[];
 class Canvas {
  constructor(){created.push(this);}
  getContext(type,options){
   assert.equal(type,'2d');
   if(!this.context){assert.equal(options?.willReadFrequently,true);this.context={clearRect(){},getImageData:()=>({data:new Uint8Array(this.width*this.height*4)})};}
   return this.context;
  }
 }
 const exports={};
 const source=readFileSync(new URL('../../../bridge/render/canvas-textures.ios.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 runInNewContext(js,{exports,require:id=>{assert.equal(id,'@nativescript/canvas');return {Canvas};},GPUTextureUsage:{TEXTURE_BINDING:1,COPY_DST:2},Uint8Array});
 let allocations=0,uploads=0,destroys=0;
 const device={createTexture(){allocations++;return {destroy(){destroys++;}};},queue:{writeTexture(){uploads++;}}};
 const bank=new exports.NativeCanvasTextures(device);
 for(let i=0;i<100;i++){
  const canvas=bank.createCanvas2D(128,128);
  assert.equal(bank.readAtlasPixels(canvas).length,128*128*4);
  bank.textureFromCanvas(canvas,'hint');
 }
 assert.equal(created.length,100);assert.equal(allocations,1);assert.equal(uploads,100);
 bank.dispose();assert.equal(destroys,1);
});
