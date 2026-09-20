import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../../../bridge/rewards/admob.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture({development=true,online=true,missing=false}={}) {
  let callback,unit;const exports={};
  class Native {
    privacyRequired=true;
    performUnitEvents(action,value,events){unit=value;callback=events;}
    dispose(){}
  }
  runInNewContext(js,{exports,require:()=>({Application:{},Connectivity:{getConnectionType:()=>online?1:0,connectionType:{none:0}},isAndroid:false,isIOS:true}),
    HYRewardedAds:missing?undefined:Native,Error,console:{log(){}}});
  const gateway=new exports.AdMobRewardGateway({development,iosUnit:development?'publisher-production-id':'ca-app-pub-3940256099942544/1712485313',androidUnit:''});
  return {gateway,event:v=>callback(v),unit:()=>unit};
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
