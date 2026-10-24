import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHyaPlayer} from '@haiyue/extensions/hya-player';

mkdirSync(new URL('../artifacts/',import.meta.url),{recursive:true});
const app=fileURLToPath(new URL('..',import.meta.url)),temp=mkdtempSync(new URL('../artifacts/resource-boundary-',import.meta.url));
// Only Foundation/filesystem are mocked; the exact example resource owner and public player run below.
const source=readFileSync(new URL('../src/scene-resources.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from '@nativescript/core'","from './native-files.js'");
writeFileSync(resolve(temp,'scene-resources.js'),js);writeFileSync(resolve(temp,'package.json'),'{"type":"module","private":true}\n');
writeFileSync(resolve(temp,'native-files.js'),`import {readFileSync} from 'node:fs';import path from 'node:path';export {path};export const knownFolders={currentApp:()=>({path:${JSON.stringify(resolve(app,'src'))}})};export const File={fromPath:file=>({readTextSync:()=>readFileSync(file,'utf8')})};`);
const {loadSceneResources}=await import(pathToFileURL(resolve(temp,'scene-resources.js')));
async function withFoundation(run){
 const before=[Object.getOwnPropertyDescriptor(globalThis,'NSData'),Object.getOwnPropertyDescriptor(globalThis,'interop')];let corrupt=false;
 Object.defineProperty(globalThis,'NSData',{value:{dataWithContentsOfFile(file){const bytes=new Uint8Array(readFileSync(file));if(corrupt&&file.endsWith('image.png'))bytes[0]^=1;return bytes;}},configurable:true});
 Object.defineProperty(globalThis,'interop',{value:{bufferFromData:bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)},configurable:true});
 try{await run(()=>{corrupt=true;});}finally{for(const [index,key]of ['NSData','interop'].entries()){if(before[index])Object.defineProperty(globalThis,key,before[index]);else Reflect.deleteProperty(globalThis,key);}}
}
test('exact Native resource owner feeds seven-part public player, releases leases and rejects stale requests',async()=>withFoundation(async()=>{
 const records=[],owner=await loadSceneResources((event,detail)=>records.push({event,detail}));let decoded=0,released=0;
 const player=await createHyaPlayer(owner.source,{mode:'evaluate',viewport:[320,480],host:{capabilities:new Set(owner.source.parts.map(p=>p.extension)),resources:owner.resources,invalidate(){},audio:{profile:'sample-accurate',sampleRate:48000,state:'suspended',nowFrame:()=>0,unlock:async()=>{},resolve:owner.resolve,async decode(resource,signal,buffer){assert.equal(signal.aborted,false);const bytes=new DataView(buffer);assert.equal(bytes.getUint32(24,true),48000);assert.equal(bytes.getUint16(22,true),1);decoded++;return{value:buffer,sampleRate:48000,channels:1,frames:4800,bytes:4800*4,release(){released++;}};},schedule(){throw Error('No Native output qualification in this CPU test.');}}}});
 try{
  let frame;for(let i=0;i<128;i++){frame=player.advance({sequence:1,deltaSeconds:0,viewport:[320,480],dpr:1});if(frame.ready)break;await new Promise(r=>setTimeout(r,0));}
  assert.equal(frame.ready,true);assert.equal(frame.layout.nodes.find(n=>n.text).text.runs.flatMap(r=>r.glyphs).map(g=>g.sequence).join(''),'你好 A');assert.equal(decoded,1);assert.equal(records[0].event,'assets-verified');
  await assert.rejects(owner.resources.acquire({kind:'font',part:'layout',asset:'font',integrity:'wrong',signal:new AbortController().signal}),/fixed manifest/);
  await assert.rejects(owner.resolve({...owner.source.parts.find(p=>p.id==='audio').document.resources[0],source:{kind:'hosted',key:'not-tone'}},new AbortController().signal),/fixed manifest/);
 }finally{player.dispose();}
 assert.equal(released,1);assert.equal(owner.snapshot().live,0);owner.dispose();assert.equal(owner.snapshot().closed,true);
 const asset=JSON.parse(readFileSync(resolve(app,'src/assets/manifest.json'),'utf8')).assets.font;
 await assert.rejects(owner.resources.acquire({kind:'font',part:'layout',asset:'font',integrity:asset.integrity,signal:new AbortController().signal}),/closed/);
}));
test('Native scene preflight rejects corrupted file bytes before creating a player',async()=>withFoundation(async corrupt=>{corrupt();await assert.rejects(loadSceneResources(()=>{}),/integrity mismatch: image/);}));
