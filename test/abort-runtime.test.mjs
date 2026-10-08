import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
class LegacySignal extends EventTarget {aborted=false;}
class LegacyController {
  signal=new LegacySignal();
  abort(){if(!this.signal.aborted){this.signal.aborted=true;this.signal.dispatchEvent(new Event('abort'));}}
}
function runtime(existing) {
 const output=ts.transpileModule(readFileSync(new URL('../bridge/lifecycle/abort-runtime.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 const context=vm.createContext({exports:{},AbortController:existing,require:()=>({AbortController:LegacyController,AbortSignal:LegacySignal})});
 vm.runInContext(output,context);context.exports.installNativeAbortRuntime();return context;
}
test('Native cancellation supplies reason before abort listeners and preserves first abort',()=>{
 const r=runtime(),c=new r.AbortController(),reason={cancel:'language switched'};let calls=0;
 assert.equal(c.signal.reason,undefined);c.signal.throwIfAborted();
 c.signal.addEventListener('abort',()=>{calls++;assert.equal(c.signal.reason,reason);assert.throws(()=>c.signal.throwIfAborted(),e=>e===reason);});
 c.abort(reason);c.abort('later');assert.equal(calls,1);assert.equal(c.signal.reason,reason);
});
test('missing reasons become AbortError; legacy globals upgrade and modern globals remain intact',()=>{
 const r=runtime(LegacyController),c=new r.AbortController();c.abort();assert.throws(()=>c.signal.throwIfAborted(),{name:'AbortError'});
 assert.equal(runtime(AbortController).AbortController,AbortController);
});
