import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import opentype from 'opentype.js';
import {parseHyaComposition} from '@haiyue/animation-spec/hya-production';
import {createHyaPlayer} from '@haiyue/extensions/hya-player';

const assets=resolve(dirname(fileURLToPath(import.meta.url)),'../src/assets'),read=name=>JSON.parse(readFileSync(resolve(assets,name),'utf8'));
const source=read('scene.json'),manifest=read('manifest.json'),sha=b=>createHash('sha256').update(b).digest('hex');
function host(corruptFont=false){
 const handles=[],decoded=[],semantics=[];let imageCalls=0,semanticReleases=0;
 const ports={capabilities:new Set(source.parts.map(p=>p.extension)),invalidate(){},
  resources:{async acquire(request){const id=request.asset==='core-image'?'alternate':request.asset,descriptor=manifest.assets[id];assert.ok(descriptor,'Undeclared scene resource: '+id);const bytes=new Uint8Array(readFileSync(resolve(assets,descriptor.file)));if(corruptFont&&id==='font')bytes[0]^=1;const handle={id,released:0};handles.push(handle);return{value:bytes,generation:1,bytes:bytes.length,release(){assert.equal(++handle.released,1);}};}},
  images:{async decode(){imageCalls++;throw Error('Pure evaluation attempted GPU image decoding');},async snapshot(){imageCalls++;throw Error('Pure evaluation attempted a bitmap snapshot');}},
  // Real fixed PCM16 WAV decoding, with no playback device or simulated timing qualification.
  audio:{profile:'sample-accurate',sampleRate:48000,state:'suspended',nowFrame:()=>0,async unlock(){throw Error('CPU scene check cannot authorize a user gesture');},async decode(resource,signal,encoded){assert.equal(signal.aborted,false);const bytes=Buffer.from(encoded);assert.equal(sha(bytes),resource.integrity.digest);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.equal(bytes.readUInt16LE(20),1);assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),48000);assert.equal(bytes.readUInt16LE(34),16);assert.equal(bytes.readUInt32LE(40),resource.frameLength*2);const pcm=new Float32Array(resource.frameLength);for(let i=0;i<pcm.length;i++)pcm[i]=bytes.readInt16LE(44+i*2)/32768;const handle={released:0,peak:Math.max(...pcm.map(Math.abs))};decoded.push(handle);assert.ok(handle.peak>0&&handle.peak<=.063);return{value:pcm,sampleRate:48000,channels:1,frames:pcm.length,bytes:pcm.byteLength,release(){assert.equal(++handle.released,1);}};},schedule(){throw Error('CPU evaluation attempted audio output');}},
  semantics:{update(value){semantics.push(value);},subscribeActions(){return{unsubscribe(){semanticReleases++;}};}},
 };return{ports,handles,decoded,semantics,get imageCalls(){return imageCalls;},get semanticReleases(){return semanticReleases;}};
}
const advance=async(player,sequence,delta=0,dpr=1,viewport=[320,480])=>{const request={sequence,deltaSeconds:delta,viewport,dpr};for(let i=0;i<128;i++){const value=player.advance(request);if(value.ready)return value;await new Promise(r=>setTimeout(r,0));}throw Error('Seven-part source did not settle');};
test('fixed assets are exact and the font contains original licensed CJK/Latin contours',()=>{
 assert.equal(source.parts.length,7);assert.equal(parseHyaComposition(source).diagnostics.length,0);assert.equal(sha(readFileSync(resolve(assets,'scene.json'))),manifest.scene.sha256);
 for(const descriptor of Object.values(manifest.assets)){const bytes=readFileSync(resolve(assets,descriptor.file));assert.equal(bytes.length,descriptor.bytes);assert.equal(sha(bytes),descriptor.sha256);}
 const raw=readFileSync(resolve(assets,manifest.assets.font.file)),font=opentype.parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));assert.equal(font.names.fontFamily.en,'Haiyue G11 Scene Sans');
 for(const character of '你好世界AB'){const glyph=font.charToGlyph(character);assert.notEqual(glyph.index,0);assert.ok(glyph.path.commands.length>0);}
 assert.match(readFileSync(resolve(assets,'FONT-LICENSE.txt'),'utf8'),/SIL OPEN FONT LICENSE/);
});
for(const dpr of [1,2])test('actual public seven-part evaluation, real font/WAV and atomic data at DPR '+dpr,async()=>{
 assert.equal(typeof globalThis.document,'undefined');assert.equal(typeof globalThis.createImageBitmap,'undefined');const h=host(),player=await createHyaPlayer(source,{mode:'evaluate',viewport:[320,480],dpr,host:h.ports});
 try{
  const first=await advance(player,1,0,dpr),text=first.layout.nodes.find(n=>n.text).text;
  const glyphs=text.runs.flatMap(run=>run.glyphs);assert.equal(glyphs.map(g=>g.sequence).join(''),'你好 A');assert.ok(glyphs.filter(g=>g.sequence!==' ').every(g=>g.id>0&&g.paint.kind==='outline'&&g.paint.commands.length>0));
  assert.equal(player.data.read('root',['label']),'你好 A');let observations=0;const subscription=player.data.subscribe(()=>observations++);
  player.data.run(write=>{write.set('root',['label'],'你好世界');write.set('root',['go'],true);});const changed=await advance(player,2,.25,dpr);
  assert.equal(changed.layout.nodes.find(n=>n.text).text.runs.flatMap(r=>r.glyphs).map(g=>g.sequence).join(''),'你好世界');assert.equal(observations,1);assert.equal(h.semantics.at(-1).nodes.find(n=>n.role==='textbox').value,'你好世界');
  subscription.unsubscribe();player.pause();assert.equal(player.status,'paused');player.resume();
  // The admitted audio profile rejects reverse before changing transport or publishing a frame.
  const before=player.lastFrame,semanticCount=h.semantics.length;
  assert.throws(()=>player.setRate(-1),error=>error.code==='E_AUDIO_RUNTIME_PROFILE'&&error.path==='$.audio.rate');
  assert.equal(player.lastFrame,before);assert.equal(player.status,'running');assert.equal(h.semantics.length,semanticCount);
  player.setRate(.5);player.seek(.1);await advance(player,3,0,dpr);assert.equal(player.lastFrame.time,.1);
  await advance(player,4,.2,dpr);assert.ok(Math.abs(player.lastFrame.time-.2)<1e-10);
  player.setRate(2);await advance(player,5,.1,dpr);assert.ok(Math.abs(player.lastFrame.time-.4)<1e-10);
  assert.equal(h.imageCalls,0);assert.equal(h.decoded.length,1);
 }finally{player.dispose();}
 assert.ok(h.handles.length>0);assert.ok(h.handles.every(handle=>handle.released===1));assert.ok(h.decoded.every(handle=>handle.released===1));assert.equal(h.semanticReleases,1);
});
test('corrupt font bytes fail integrity and release prepared resource leases',async()=>{
 const h=host(true);await assert.rejects(createHyaPlayer(source,{mode:'evaluate',viewport:[320,480],host:h.ports}));assert.ok(h.handles.every(handle=>handle.released===1));assert.ok(h.decoded.every(handle=>handle.released===1));
});
for(const viewport of [[320,480],[390,844],[844,390]])test('Native scene text/semantic geometry agrees in logical coordinates at '+viewport.join('x'),async()=>{
 const h=host(),player=await createHyaPlayer(source,{mode:'evaluate',viewport,dpr:2,host:h.ports});
 try{const frame=await advance(player,1,0,2,viewport),text=frame.layout.nodes.find(node=>node.text),field=frame.semantics.nodes.find(node=>node.role==='textbox');assert.deepEqual(text.rect,[20,180,280,60]);assert.deepEqual(field.bounds,text.rect);assert.equal(text.transform,undefined);assert.deepEqual(JSON.parse(field.id),['semantics','field']);assert.equal(frame.layout.nodes.find(node=>node.node==='action-text').text.runs.flatMap(run=>run.glyphs).map(glyph=>glyph.sequence).join(''),'Activate');}finally{player.dispose();}
 assert.ok(h.handles.every(handle=>handle.released===1));
});
test('previous centered artboard reproduces the portrait text/interaction mismatch',async()=>{
 const before=structuredClone(source),layout=before.parts.find(part=>part.id==='layout');layout.document.instances[0].alignment=[0,0];
 const h=host(),viewport=[390,844],player=await createHyaPlayer(before,{mode:'evaluate',viewport,dpr:2,host:h.ports});
 try{const frame=await advance(player,1,0,2,viewport),text=frame.layout.nodes.find(node=>node.text),field=frame.semantics.nodes.find(node=>node.role==='textbox');assert.deepEqual(text.rect,[20,309.5,280,60]);assert.deepEqual(field.bounds,[20,180,280,60]);assert.notDeepEqual(text.rect,field.bounds);}finally{player.dispose();}
 assert.ok(h.handles.every(handle=>handle.released===1));
});
