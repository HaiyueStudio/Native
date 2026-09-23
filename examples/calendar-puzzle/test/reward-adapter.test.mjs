import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../../../bridge/rewards/admob.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture({development=true,online=true,missing=false}={}) {
  let callback,unit,action;const exports={};
  class Native {
    privacyRequired=true;
    performUnitEvents(operation,value,events){action=operation;unit=value;callback=events;}
    dispose(){}
  }
  runInNewContext(js,{exports,require:()=>({Application:{},Connectivity:{getConnectionType:()=>online?1:0,connectionType:{none:0}},isAndroid:false,isIOS:true}),
    HYRewardedAds:missing?undefined:Native,Error,console:{log(){}}});
  const gateway=new exports.AdMobRewardGateway({development,iosUnit:development?'publisher-production-id':'ca-app-pub-3940256099942544/1712485313',androidUnit:''});
  return {gateway,event:v=>callback(v),unit:()=>unit,action:()=>action};
}
test('debug adapter forces official demo units and resolves only on dismissal',async()=>{
  const f=fixture();let earned=0,ended=false;const promise=f.gateway.show(()=>earned++).then(()=>ended=true);
  assert.equal(f.unit(),'ca-app-pub-3940256099942544/1712485313');f.event('presenting');f.event('earned');assert.equal(earned,1);assert.equal(ended,false);
  f.event('closed');await promise;f.event('earned');assert.equal(earned,1);
});
test('release refuses demo units; offline fails before loading SDK',async()=>{
  await assert.rejects(fixture({development:false}).gateway.show(()=>{}),/unavailable/);
  await assert.rejects(fixture({online:false}).gateway.show(()=>{}),/offline/);
});
test('SDK absence cannot crash quota snapshots; no-fill yields an unavailable result',async()=>{
  assert.equal(fixture({missing:true}).gateway.privacyRequired(),false);
  const f=fixture();const show=f.gateway.show(()=>assert.fail('no reward on no-fill'));f.event('error:unavailable');await assert.rejects(show,/unavailable/);
});

test('startup uses consent action once and never invokes reward callbacks',async()=>{
  const f=fixture();let done=false;
  const first=f.gateway.initialize(),second=f.gateway.initialize();assert.equal(first,second);
  first.then(()=>done=true);assert.equal(f.action(),'consent');assert.equal(done,false);f.event('closed');await first;
  assert.equal(done,true);
});

test('paid consent refresh is separate from ad loading and permits privacy access without a configured ad unit',async()=>{
  const f=fixture({development:false});const pending=f.gateway.initialize(false);
  assert.equal(f.action(),'refreshPrivacy');f.event('closed');await pending;
  const privacy=f.gateway.privacy();assert.equal(f.action(),'privacy');f.event('closed');await privacy;
});
