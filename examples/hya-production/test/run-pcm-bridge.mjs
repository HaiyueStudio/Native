import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(app,'artifacts/pcm-bridge-'+Date.now());mkdirSync(out,{recursive:true});
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),pin=p=>({path:p,sha256:sha(p)});
const compiler=process.env.HYA_CXX??'clang++',zig=process.env.HYA_CXX_KIND==='zig',files={};
for(const name of ['native/HyaPcmMixer.hpp','native/HyaPcmBridge.hpp','test/pcm-mixer.test.cpp','test/pcm-bridge.test.cpp']){
 const original=resolve(app,name),snapshot=resolve(out,'snapshot',name);mkdirSync(dirname(snapshot),{recursive:true});copyFileSync(original,snapshot);assert.equal(sha(snapshot),sha(original));files[name]={original:pin(original),snapshot:pin(snapshot)};
}
const driverSnapshot=resolve(out,'runner-source.mjs');copyFileSync(fileURLToPath(import.meta.url),driverSnapshot);
const report={status:'running',driver:pin(fileURLToPath(import.meta.url)),driverSnapshot:pin(driverSnapshot),compiler,files,suites:[],scope:'Real desktop C++ compilation and execution of the portable render kernel plus one-producer/one-consumer bridge. Snapshot sources retained. No iOS SDK/audio callback/decoder/NativeScript or physical-device qualification.',physicalNativeQualified:false,fullG11Complete:false};
const save=()=>writeFileSync(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');save();console.log(out);
try{
 for(const [name,count]of [['pcm-mixer',18],['pcm-bridge',15]]){
  const binary=resolve(out,name+(process.platform==='win32'?'.exe':'')),source=resolve(out,'snapshot/test',name+'.test.cpp'),args=[...(zig?['c++']:[]),'-std=c++17','-Wall','-Wextra','-Werror','-O2','-g',source,'-o',binary];
  const compile=spawnSync(compiler,args,{encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:8*1024*1024}),compilePath=resolve(out,name+'-compile.log');writeFileSync(compilePath,String(compile.stdout??'')+String(compile.stderr??''));
  const suite={name,compileArgs:args,compileLog:pin(compilePath)};report.suites.push(suite);save();assert.equal(compile.status,0,compile.error?.stack??compile.stderr);
  suite.binary=pin(binary);const pcmPath=resolve(out,name+'-pcm.json'),run=spawnSync(binary,[pcmPath],{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:8*1024*1024}),log=resolve(out,name+'-test.log');writeFileSync(log,String(run.stdout??'')+String(run.stderr??''));suite.testLog=pin(log);save();assert.equal(run.status,0,run.error?.stack??run.stderr);
  const match=String(run.stdout).match(/SUMMARY (\{[^\n]+\})/);assert.ok(match);suite.summary=JSON.parse(match[1]);assert.equal(suite.summary.passed,count);suite.pcm=pin(pcmPath);assert.equal(JSON.parse(readFileSync(pcmPath,'utf8')).length,7);
  if(name==='pcm-bridge'){
   const concurrency=String(run.stdout).match(/CONCURRENCY (\{[^\n]+\})/);assert.ok(concurrency);suite.concurrency=JSON.parse(concurrency[1]);assert.equal(suite.concurrency.accepted,20000);assert.equal(suite.concurrency.completed,20000);assert.equal(suite.concurrency.createdOwners,suite.concurrency.destroyedOwners);assert.equal(suite.concurrency.wrongThreadDestructors,0);assert.equal(suite.summary.operatorNewDuringRender,0);assert.equal(suite.summary.operatorDeleteDuringRender,0);
  }
  suite.status='passed';save();
 }
 for(const value of Object.values(files)){assert.equal(sha(value.original.path),value.original.sha256);assert.equal(sha(value.snapshot.path),value.snapshot.sha256);}
 report.status='passed-portable-native-pcm-kernel-and-thread-bridge';
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
save();console.log(JSON.stringify({out,status:report.status,suites:report.suites.map(s=>({name:s.name,summary:s.summary,concurrency:s.concurrency})),error:report.error}));
