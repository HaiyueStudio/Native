import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('retained ObjC callbacks release page captures on disposal, including jitless V8',()=>{
 const source=ts.transpileModule(readFileSync('bridge/ui/nativescript/native-callback.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const module='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 const code=`
 import assert from 'node:assert/strict';
 import {createNativeCallback} from ${JSON.stringify(module)};
 const events=[];
 let page={name:'editor'};
 const weak=new WeakRef(page);
 const relay=createNativeCallback(((owner)=>(value)=>events.push(owner.name+value))(page));
 const nativeBlock=relay.invoke;
 nativeBlock(' active');
 assert.deepEqual(events,['editor active']);
 page=null;
 relay.dispose();relay.dispose();
 for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,0));global.gc();}
 assert.equal(weak.deref(),undefined,'native block still roots page');
 nativeBlock(' late');
 assert.deepEqual(events,['editor active']);
 `;
 const result=spawnSync(process.execPath,['--jitless','--expose-gc','--input-type=module','-e',code],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
});
