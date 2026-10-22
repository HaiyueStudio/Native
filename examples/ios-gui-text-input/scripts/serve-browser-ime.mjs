import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,[fileURLToPath(new URL('./verify-candidate.mjs',import.meta.url))],{stdio:'inherit'});
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),workspace=fileURLToPath(new URL('../../../../',import.meta.url));
const manifest=JSON.parse(readFileSync(resolve(app,'qualified-candidate.json'),'utf8'));
const out=resolve(app,'artifacts',`browser-ime-${Date.now()}`);mkdirSync(out,{recursive:true});
const routes=new Map([
 ['/examples/gui-runtime/','Engine/examples/gui-runtime/index.html'],['/examples/gui-runtime/index.html','Engine/examples/gui-runtime/index.html'],
 ['/examples/gui-runtime/bundle.js','Engine/examples/gui-runtime/bundle.js'],['/examples/shared/engine.js','Engine/examples/shared/engine.js'],
]);
const served=new Map(),sha=data=>createHash('sha256').update(data).digest('hex');
const collector=`<script>addEventListener('DOMContentLoaded',()=>{const b=document.createElement('button');b.textContent='Save real IME evidence';Object.assign(b.style,{position:'fixed',right:'12px',top:'12px',zIndex:2147483647});document.body.append(b);b.onclick=async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const state=JSON.parse(document.querySelector('canvas').dataset.textEditing);const response=await fetch('/g06-evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:1,userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},state,qualification:'Human-operated browser checkpoint; visual candidate correctness still requires human confirmation.'})});b.textContent=await response.text();};});</script>`;
const server=createServer(async(request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1:8123');response.setHeader('Cache-Control','no-store');
 if(url.pathname==='/favicon.ico'){response.statusCode=204;response.end();return;}
 if(url.pathname==='/g06-evidence'&&request.method==='POST'){
  try{
   const chunks=[];let length=0;for await(const chunk of request){length+=chunk.length;if(length>256*1024)throw Error('Evidence exceeds 256 KiB.');chunks.push(chunk);}
   const checkpoint=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(checkpoint.schemaVersion!==1||!checkpoint.state?.fields||!checkpoint.state?.trace)throw Error('Missing GUI checkpoint.');
   const file=resolve(out,`checkpoint-${Date.now()}.json`);
   writeFileSync(file,JSON.stringify({schemaVersion:1,status:'human-checkpoint-pending-review',candidateId:manifest.candidateId,time:new Date().toISOString(),served:[...served.values()],checkpoint},null,2)+'\n');
   console.log(`Saved: ${file}`);response.end('Saved; see terminal path');
  }catch(error){response.statusCode=400;response.end(String(error));}return;
 }
 if(url.pathname==='/'){response.statusCode=302;response.setHeader('Location','/examples/gui-runtime/?text-input=1');response.end();return;}
 const relative=routes.get(url.pathname);
 if(request.method!=='GET'||!relative){response.statusCode=404;response.end('Not found');return;}
 try{
  const original=readFileSync(resolve(workspace,relative)),html=relative.endsWith('.html');
  const expected=manifest.files.find(file=>file.path===relative);if(!expected||sha(original)!==expected.sha256||original.length!==expected.bytes)throw Error('Browser bytes changed after candidate verification.');
  const bytes=html?Buffer.from(original.toString('utf8')+collector):original;
  served.set(relative,{path:relative,sourceSha256:sha(original),servedSha256:sha(bytes),sourceBytes:original.length,servedBytes:bytes.length,collectorInjected:html});
  response.setHeader('Content-Type',html?'text/html; charset=utf-8':'text/javascript; charset=utf-8');response.end(bytes);
 }catch(error){response.statusCode=500;response.end(String(error));}
});
server.listen(8123,'127.0.0.1',()=>console.log(`Open http://127.0.0.1:8123/ in this Mac's WebGPU browser. Keep this terminal open; Ctrl+C stops it. Evidence folder: ${out}`));
