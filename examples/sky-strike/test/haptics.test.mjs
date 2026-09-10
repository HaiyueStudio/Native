import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../../../bridge/feedback/haptics.ios.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
test('native feedback selects impact style, limits clustered kills and suppresses background/disposed events',async()=>{
 const calls=[];globalThis.UIImpactFeedbackStyle={Light:0,Medium:1,Heavy:2};
 globalThis.UIImpactFeedbackGenerator={alloc:()=>({initWithStyle(style){return{prepare(){},impactOccurred(){calls.push(style);}};}})};
 globalThis.NSProcessInfo={processInfo:{systemUptime:1}};
 try{const {NativeHaptics}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);const h=new NativeHaptics();
 h.impact('light');assert.deepEqual(calls,[]);h.resume();h.impact('light');h.impact('light');h.impact('medium');h.impact('medium');h.impact('heavy');h.impact('heavy');assert.deepEqual(calls,[0,1,2]);
 NSProcessInfo.processInfo.systemUptime+=.3;h.impact('light');assert.deepEqual(calls,[0,1,2,0]);
 h.suspend();NSProcessInfo.processInfo.systemUptime+=1;h.impact('heavy');assert.equal(calls.length,4);
 h.resume();h.impact('heavy');assert.equal(calls.length,5);h.dispose();h.resume();h.impact('heavy');assert.equal(calls.length,5);assert.equal(h.snapshot().active,false);
 }finally{delete globalThis.UIImpactFeedbackStyle;delete globalThis.UIImpactFeedbackGenerator;delete globalThis.NSProcessInfo;}
});
