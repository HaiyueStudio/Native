import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {IndexedSpriteRenderer,DEFAULT_INDEXED_SPRITE_ATLAS_LIMITS} from '@haiyue/extensions/experimental/indexed-sprite';
// Resource-lifetime test double; rendering itself still uses the real packaged renderer.
function resourceDevice(fences) {
 globalThis.GPUBufferUsage ??= {COPY_DST:8,UNIFORM:64,STORAGE:128};
 globalThis.GPUTextureUsage ??= {COPY_DST:2,TEXTURE_BINDING:4,RENDER_ATTACHMENT:16};
 globalThis.GPUShaderStage ??= {VERTEX:1,FRAGMENT:2};
 globalThis.GPUColorWrite ??= {ALL:15};
 const resources={texture:new Set(),buffer:new Set()};
 const own=(kind,descriptor)=>{
  const resource={...descriptor,destroy(){resources[kind].delete(resource);}};
  if(kind==='texture')resource.createView=()=>({texture:resource});
  resources[kind].add(resource);return resource;
 };
 const noop=()=>{},descriptor=value=>value;
 const device={
  limits:{maxTextureDimension2D:8192},
  createTexture:d=>own('texture',d),createBuffer:d=>own('buffer',d),
  createShaderModule:descriptor,createBindGroupLayout:descriptor,createBindGroup:descriptor,
  createPipelineLayout:descriptor,createRenderPipeline:descriptor,createSampler:descriptor,
  createCommandEncoder:()=>({beginRenderPass:()=>({setBindGroup:noop,setPipeline:noop,draw:noop,end:noop}),finish:()=>({})}),
  queue:{writeTexture:noop,writeBuffer:noop,submit:noop,onSubmittedWorkDone:()=>new Promise((resolve,reject)=>fences.push({resolve,reject}))},
 };
 return {device,live:kind=>resources[kind].size};
}

async function loadLayer(){
 const compiled=ts.transpileModule(readFileSync(new URL('../../../games/sky-strike/battleLayer.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\r?\n/gm,'');
 globalThis.__skyPreviewDependencies={IndexedSpriteRenderer,DEFAULT_INDEXED_SPRITE_ATLAS_LIMITS,System:class{destroy(){return this;}},skyStrikeViewport:()=>({scale:1,left:0,width:480,visibleWidth:480,cameraX:0}),blackHolePortrait:()=>({id:'hole',width:1,height:1,format:'rgba8',pixels:new Uint8Array(4)}),mirrorSprites:()=>[]};
 try{return(await import(`data:text/javascript;base64,${Buffer.from(`const {${Object.keys(globalThis.__skyPreviewDependencies).join(',')}}=globalThis.__skyPreviewDependencies;\n${compiled}`).toString('base64')}`)).SkyStrikeBattleLayer;}finally{delete globalThis.__skyPreviewDependencies;}
}

test('preview resources retire at GPU completion, cache remains valid and pending commands stay isolated',async()=>{
 const Layer=await loadLayer(),fences=[];
 const {device,live}=resourceDevice(fences);
 const engine={device,format:'rgba8unorm',msaaSamples:4,displayWidth:480,displayHeight:960};
 const layer=new Layer(engine,[{id:'hull',width:4,height:4,format:'rgba8',pixels:new Uint8Array(64).fill(255)}]);
 layer.begin(240);layer.sprite('hull',100,200,20,40);const before=structuredClone(layer.commands);
 const textureLive=live('texture');
 const first=layer.guiComposition('first',r=>r.sprite('hull',240,240,50,100));
 assert.deepEqual(layer.commands,before,'preview drawing must not mutate the pending battle command');
 assert.equal(layer.stats().pendingPreviewCompositions,1);
 assert.ok(live('texture')>textureLive+1,'temporary atlas and MSAA remain alive before the fence');
 assert.equal(layer.guiComposition('first',()=>assert.fail('cached preview rerendered')),first);
 fences[0].resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(layer.stats().pendingPreviewCompositions,0);
 assert.equal(live('texture'),textureLive+1,'only the cached portrait remains');
 layer.guiComposition('second',r=>r.sprite('hull',240,240,50,100));
 fences[1].reject(new Error('device lost'));await Promise.resolve();await Promise.resolve();
 assert.equal(layer.stats().pendingPreviewCompositions,0,'failed completion must release temporary owners');
 layer.guiComposition('third',r=>r.sprite('hull',240,240,50,100));
 layer.destroy();fences[2].resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(live('texture'),0);assert.equal(live('buffer'),0);
});
