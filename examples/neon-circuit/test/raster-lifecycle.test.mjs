import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/raster.ts',import.meta.url),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020},
}).outputText.replace(/^import .*;$/gm,'');
const host=`
const File={fromPath:()=>({readTextSync:()=> '{}'})};
const knownFolders={currentApp:()=>({path:'/app'})};const path={join:(...parts)=>parts.join('/')};
class NativeCanvasTextures {
  createCanvas2D(width,height){return {width,height,disposed:0,disposeNativeView(){this.disposed++;}};}
  readAtlasPixels(){return new Uint8Array([1,2,3,4]);}
}
`;
const {NativeNeonRaster}=await import(`data:text/javascript;base64,${Buffer.from(host+source).toString('base64')}`);
test('temporary native canvases survive repeated same-frame uploads and release backing stores exactly once',()=>{
  const raster=new NativeNeonRaster({}),canvas=raster.canvas(1280,720);
  for(let i=0;i<4;i++)assert.deepEqual([...raster.pixels(canvas)],[1,2,3,4]);
  assert.equal(canvas.disposed,0);assert.equal(canvas.width,1280);
  assert.equal(raster.flushTransient(),1);assert.equal(canvas.disposed,1);
  assert.equal(canvas.width,1);assert.equal(canvas.height,1);assert.equal(raster.surfaceCount,0);
  assert.equal(raster.flushTransient(),0);assert.equal(canvas.disposed,1);
});
test('font atlases remain valid across frames and release only after their scene is destroyed',()=>{
  const raster=new NativeNeonRaster({}),font=raster.font.canvasFactory(2048,2048),image=raster.canvas(640,780);
  raster.flushTransient();assert.equal(font.disposed,0);assert.equal(image.disposed,1);assert.equal(raster.surfaceCount,1);
  raster.releaseScene();assert.equal(font.disposed,1);assert.equal(raster.surfaceCount,0);
  raster.releaseScene();assert.equal(font.disposed,1);
});
test('many language redraws and consecutive courses keep the native surface count bounded',()=>{
  const raster=new NativeNeonRaster({});
  for(let course=0;course<20;course++){
    raster.font.canvasFactory(2048,2048);
    for(let language=0;language<3;language++){
      for(let route=0;route<6;route++)raster.pixels(raster.canvas(640,780));
      raster.flushTransient();assert.equal(raster.surfaceCount,1);
    }
    raster.releaseScene();assert.equal(raster.surfaceCount,0);
  }
});
