import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

test('frame runtime releases disposed owners without clearing a newer host',()=>{
 const source=ts.transpileModule(readFileSync('bridge/lifecycle/runtime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const code=`
 import assert from 'node:assert/strict';
 const runtime={},events=[];
 const require=name=>name==='./frame-scheduler'?{createFrameScheduler:(_driver,report)=>({report,request:()=>1,cancel:()=>{}})}:name==='./abort-runtime'?{installNativeAbortRuntime(){}}:name.includes('profiling')?{time:()=>0}:{requestAnimationFrame(){},cancelAnimationFrame(){}};
 new Function('require','exports',${JSON.stringify(source)})(require,runtime);
 let a={id:'a'},b={id:'b'};const wa=new WeakRef(a),wb=new WeakRef(b);
 const callback=owner=>message=>events.push(owner.id+message);
 const releaseA=runtime.installNativeFrameRuntime(callback(a)),raf=globalThis.requestAnimationFrame;
 const releaseB=runtime.installNativeFrameRuntime(callback(b));
 assert.equal(globalThis.requestAnimationFrame,raf);
 runtime.nativeFrames.report('1');releaseA();releaseA();runtime.nativeFrames.report('2');
 assert.deepEqual(events,['b1','b2']);
 releaseB();a=null;b=null;
 for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,0));global.gc();}
 assert.equal(wa.deref(),undefined);assert.equal(wb.deref(),undefined);
 const original=console.error;console.error=message=>events.push('default'+message);
 runtime.nativeFrames.report('3');console.error=original;
 assert.deepEqual(events,['b1','b2','default3']);
 `;
 const result=spawnSync(process.execPath,['--jitless','--expose-gc','--input-type=module','-e',code],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
});
