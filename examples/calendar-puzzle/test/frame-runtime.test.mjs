import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const moduleUrl=source=>'data:text/javascript,'+encodeURIComponent(source);
registerHooks({resolve(specifier,context,next){
 const sources={
  '@nativescript/core/animation-frame':'export const callbacks=new Map();let next=0;export function requestAnimationFrame(cb){const id=next++;callbacks.set(id,cb);return id;}export function cancelAnimationFrame(id){callbacks.delete(id);}',
  '@nativescript/core/profiling':'export const time=()=>42;',
  '@nativescript/core/abortcontroller':'export const AbortController=globalThis.AbortController;export const AbortSignal=globalThis.AbortSignal;',
 };
 if(sources[specifier])return {url:moduleUrl(sources[specifier]),shortCircuit:true};
 if(specifier==='./frame-scheduler')return next(specifier+'.ts',context);
 return next(specifier,context);
}});
test('native frame runtime replaces configurable getter-only globals and preserves cancellation',async()=>{
 const driver=await import('@nativescript/core/animation-frame');
 Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,get:()=>driver.requestAnimationFrame});
 Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,get:()=>driver.cancelAnimationFrame});
 const {installNativeFrameRuntime,nativeFrames}=await import('../../../bridge/lifecycle/runtime.ts');
 const errors=[];installNativeFrameRuntime(e=>errors.push(e));
 let called=false;const id=requestAnimationFrame(()=>{called=true;});
 assert.equal(nativeFrames.pendingCount,1);cancelAnimationFrame(id);
 assert.equal(driver.callbacks.size,0);assert.equal(called,false);
 requestAnimationFrame(()=>{throw new Error('frame failure');});
 [...driver.callbacks.values()][0]();
 assert.equal(errors[0].message,'frame failure');assert.equal(nativeFrames.pendingCount,0);
 assert.doesNotThrow(()=>installNativeFrameRuntime(()=>{}));
});
