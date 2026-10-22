import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {request} from 'node:http';
import {once} from 'node:events';

function fixture(t){
 const directory=mkdtempSync(path.join(tmpdir(),'g06-text-launcher-')),root=path.join(directory,'packet'),app=path.join(root,'Native/examples/ios-gui-text-input');
 const write=(name,data)=>{const file=path.join(root,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,data);return file;};
 const scripts=new URL('../examples/ios-gui-text-input/scripts/',import.meta.url);
 for(const name of ['verify-candidate.mjs','serve-browser-ime.mjs'])write('Native/examples/ios-gui-text-input/scripts/'+name,readFileSync(new URL(name,scripts)));
 const files=[['Engine/examples/gui-runtime/index.html','<!doctype html><html><body>Transport fixture only</body></html>'],['Engine/examples/gui-runtime/bundle.js','/* GUI bundle placeholder: transport test only */'],['Engine/examples/shared/engine.js','/* Engine placeholder: transport test only */']].map(([name,source])=>{const file=write(name,source),bytes=readFileSync(file);return {path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
 const manifest={schemaVersion:1,candidateId:'automated-transport-fixture-not-a-qualified-candidate',files},manifestFile=path.join(app,'qualified-candidate.json');writeFileSync(manifestFile,JSON.stringify(manifest));
 t.after(()=>{assert.equal(path.dirname(realpathSync(directory)),realpathSync(tmpdir()));assert.match(path.basename(directory),/^g06-text-launcher-/u);rmSync(directory,{recursive:true,force:true});});
 return {directory,root,app,files,manifest,manifestFile,verify:()=>spawnSync(process.execPath,[path.join(app,'scripts/verify-candidate.mjs')],{encoding:'utf8'})};
}

test('candidate verifier accepts exact bytes and rejects both modified members and a real outside-file path',t=>{
 const f=fixture(t);assert.equal(f.verify().status,0);
 writeFileSync(path.join(f.root,f.files[1].path),'changed');assert.equal(f.verify().status,1);
 const outside=path.join(f.directory,'outside.txt');writeFileSync(outside,'outside');
 writeFileSync(f.manifestFile,JSON.stringify({...f.manifest,files:[{path:'../outside.txt',bytes:7,sha256:createHash('sha256').update('outside').digest('hex')}]}));
 const denied=f.verify();assert.equal(denied.status,1);assert.match(denied.stdout,/escapes candidate root/u);
});

test('browser collection server preserves chunked Unicode, audits served bytes and stops its owned process',async t=>{
 const f=fixture(t),child=spawn(process.execPath,[path.join(f.app,'scripts/serve-browser-ime.mjs')],{cwd:f.app,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill();await ended;}});
 await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>reject(Error('server did not start: '+stdout+stderr)),8000);const check=()=>{if(stdout.includes('Open http://127.0.0.1:8123/')){clearTimeout(deadline);child.stdout.off('data',check);resolve();}};child.stdout.on('data',check);child.once('error',reject);child.once('exit',()=>{clearTimeout(deadline);reject(Error('server exited: '+stdout+stderr));});check();});
 const html=await fetch('http://127.0.0.1:8123/examples/gui-runtime/').then(r=>r.text());assert.match(html,/Save real IME evidence/u);
 for(const name of ['/examples/gui-runtime/bundle.js','/examples/shared/engine.js'])assert.equal((await fetch('http://127.0.0.1:8123'+name)).status,200);
 const value='你好😀\r\n👩🏽‍💻',payload=Buffer.from(JSON.stringify({schemaVersion:1,state:{fields:[{id:'fixture',value}],trace:[]},qualification:'AUTOMATED TRANSPORT SMOKE ONLY; not human IME evidence'}));
 const status=await new Promise((resolve,reject)=>{const req=request('http://127.0.0.1:8123/g06-evidence',{method:'POST',headers:{'Content-Type':'application/json'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});req.on('error',reject);for(const byte of payload)req.write(Buffer.from([byte]));req.end();});assert.equal(status,200);
 const output=path.join(f.app,'artifacts'),folder=path.join(output,readdirSync(output)[0]),file=path.join(folder,readdirSync(folder).find(n=>n.endsWith('.json'))),record=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(record.checkpoint.state.fields[0].value,value);assert.equal(record.status,'human-checkpoint-pending-review');assert.equal(record.served.length,3);assert.ok(record.served.every(row=>row.sourceSha256===f.files.find(file=>file.path===row.path).sha256));
 writeFileSync(path.join(f.root,f.files[2].path),'tampered after verification');assert.equal((await fetch('http://127.0.0.1:8123/examples/shared/engine.js')).status,500);
 const ended=once(child,'exit');child.kill();await ended;assert.ok(child.exitCode!==null||child.signalCode!==null);
});
