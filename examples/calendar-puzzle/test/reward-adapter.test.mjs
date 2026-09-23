import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../../../bridge/rewards/admob.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture({development=true,online=true,missing=false,consentRequired=false}={}) {
  let callback,unit,action;const exports={},actions=[],continuations=[];
  class Native {
    privacyRequired=true;
    consentRequired=consentRequired;
    performUnitEvents(operation,value,events){actions.push(operation);action=operation;unit=value;callback=events;}
    continuePresentation(ready){continuations.push(ready);if(!ready)callback('error:unavailable');}
    dispose(){callback?.('error:unavailable');}
  }
  runInNewContext(js,{exports,require:()=>({Application:{},Connectivity:{getConnectionType:()=>online?1:0,connectionType:{none:0}},isAndroid:false,isIOS:true}),
    HYRewardedAds:missing?undefined:Native,Error,console:{log(){}}});
  const gateway=new exports.AdMobRewardGateway({development,iosUnit:development?'publisher-production-id':'ca-app-pub-3940256099942544/1712485313',androidUnit:''});
  return {gateway,event:v=>callback(v),unit:()=>unit,action:()=>action,actions,continuations};
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

test('startup refresh without a required form never requests presentation or ads',async()=>{
  const f=fixture();let done=false;
  const pause=()=>assert.fail('no form must not pause input');
  const first=f.gateway.initialize(true,pause),second=f.gateway.initialize(true,pause);assert.equal(first,second);
  first.then(()=>done=true);assert.equal(f.action(),'refreshPrivacy');assert.equal(done,false);f.event('closed');await first;
  assert.equal(done,true);assert.deepEqual(f.actions,['refreshPrivacy']);
});

test('paid consent refresh is separate from ad loading and permits privacy access without a configured ad unit',async()=>{
  const f=fixture({development:false,consentRequired:true});const pending=f.gateway.initialize(false,()=>assert.fail('paid refresh must not present'));
  assert.equal(f.action(),'refreshPrivacy');f.event('closed');await pending;
  const privacy=f.gateway.privacy();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.action(),'privacy');f.event('closed');await privacy;
});

test('required form waits for pause preparation after refresh, then presents without another update',async()=>{
  const f=fixture({consentRequired:true});let prepared;
  const pending=f.gateway.initialize(true,()=>new Promise(resolve=>{prepared=resolve;}));
  assert.equal(prepared,undefined);f.event('closed');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.action(),'presentConsent');assert.equal(prepared,undefined);
  f.event('presenting');assert.deepEqual(f.continuations,[]);prepared(true);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.continuations,[true]);f.event('closed');await pending;
});

test('an explicit ad waits for startup refresh and retries after a network failure',async()=>{
  const f=fixture();const startup=f.gateway.initialize(true,()=>assert.fail('failed refresh cannot present'));
  const rejected=assert.rejects(startup,/unavailable/);const ad=f.gateway.show(()=>{});
  assert.deepEqual(f.actions,['refreshPrivacy']);f.event('error:unavailable');await rejected;
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.action(),'show');f.event('closed');await ad;
});

test('cancelled preparation and disposal never start a late consent form',async()=>{
  for(const dispose of [false,true]) {
    const f=fixture({consentRequired:true});let prepared;
    const pending=f.gateway.initialize(true,()=>new Promise(resolve=>{prepared=resolve;}));
    const rejected=assert.rejects(pending,/unavailable/);
    f.event('closed');await new Promise(resolve=>setImmediate(resolve));
    f.event('presenting');if(dispose) f.gateway.dispose();prepared(false);await rejected;
    assert.equal(f.continuations.includes(true),false);
  }
});

test('ad download remains active until native requests presentation and consent dismissal resumes loading',async()=>{
  const f=fixture();let ready,closed=0;
  const pending=f.gateway.show(()=>{}, { prepare:()=>new Promise(resolve=>{ready=resolve;}), closed:()=>closed++ });
  assert.equal(ready,undefined);assert.equal(f.action(),'show');
  f.event('presenting');f.event('presenting');assert.deepEqual(f.continuations,[]);
  ready(true);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.continuations,[true]);
  f.event('presentation-closed');assert.equal(closed,1);
  f.event('presenting');ready(true);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.continuations,[true,true]);f.event('closed');await pending;assert.equal(closed,2);
});
