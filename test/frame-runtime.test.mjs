import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './support/load-ts.mjs';

test('frame error ownership falls back on release and never calls disposed hosts',()=>{
 let pending;
 const fallback=[],first=[],second=[];
 const runtime=loadTS('bridge/lifecycle/runtime.ts',{
  '@nativescript/core/animation-frame':{requestAnimationFrame:callback=>{pending=callback;return 0;},cancelAnimationFrame:()=>{}},
  '@nativescript/core/profiling':{time:()=>42},
  './abort-runtime':{installNativeAbortRuntime:()=>{}},
 },{console:{error:error=>fallback.push(error)}});
 const throwFrame=()=>{runtime.nativeFrames.request(()=>{throw Error('frame');});pending();};
 const releaseFirst=runtime.installNativeFrameRuntime(error=>first.push(error));
 const releaseSecond=runtime.installNativeFrameRuntime(error=>second.push(error));
 throwFrame();assert.equal(second.length,1);assert.equal(first.length,0);
 releaseSecond();releaseSecond();throwFrame();assert.equal(second.length,1);assert.equal(first.length,1);
 releaseFirst();throwFrame();assert.equal(first.length,1);assert.equal(fallback.length,1);
 const releaseThird=runtime.installNativeFrameRuntime(error=>second.push(error));
 const releaseFourth=runtime.installNativeFrameRuntime(error=>first.push(error));
 releaseThird();throwFrame();assert.equal(first.length,2);assert.equal(second.length,1);
 releaseFourth();throwFrame();assert.equal(fallback.length,2);
});
