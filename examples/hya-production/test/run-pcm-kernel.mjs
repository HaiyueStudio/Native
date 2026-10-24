import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(app,'artifacts/pcm-kernel-'+Date.now());mkdirSync(out,{recursive:true});
const compiler=process.env.HYA_CXX??'clang++',zig=process.env.HYA_CXX_KIND==='zig',binary=resolve(out,process.platform==='win32'?'pcm-kernel.exe':'pcm-kernel');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),pin=p=>({path:p,sha256:sha(p)});
const source=resolve(app,'test/pcm-mixer.test.cpp'),header=resolve(app,'native/HyaPcmMixer.hpp');
const args=[...(zig?['c++']:[]),'-std=c++17','-Wall','-Wextra','-Werror','-O2','-g',source,'-o',binary];
const report={status:'running',driver:pin(fileURLToPath(import.meta.url)),source:pin(source),header:pin(header),compiler,args,scope:'Portable native C++ PCM kernel on the current desktop host. No iOS SDK, AVAudioSourceNode callback, command queue, decoder, NativeScript binding or physical-device qualification.',physicalNativeQualified:false,fullG11Complete:false};
const save=()=>writeFileSync(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');save();console.log(out);
try{
 const compile=spawnSync(compiler,args,{encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:8*1024*1024});
 writeFileSync(resolve(out,'compile.log'),String(compile.stdout??'')+String(compile.stderr??''));report.compileLog=pin(resolve(out,'compile.log'));
 assert.equal(compile.status,0,compile.error?.stack??compile.stderr);
 report.binary=pin(binary);const pcm=resolve(out,'pcm.json'),run=spawnSync(binary,[pcm],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:8*1024*1024});
 writeFileSync(resolve(out,'test.log'),String(run.stdout??'')+String(run.stderr??''));report.testLog=pin(resolve(out,'test.log'));assert.equal(run.status,0,run.error?.stack??run.stderr);
 const match=String(run.stdout).match(/SUMMARY (\{[^\n]+\})/);assert.ok(match);report.summary=JSON.parse(match[1]);assert.equal(report.summary.passed,18);assert.equal(report.summary.kernelRenderAllocations,0);
 report.pcm=pin(pcm);const samples=JSON.parse(readFileSync(pcm,'utf8'));assert.equal(samples.length,7);assert.ok(samples.every(c=>c.pcm.length===512));
 assert.equal(sha(header),report.header.sha256);assert.equal(sha(source),report.source.sha256);report.status='passed-portable-native-pcm-kernel';
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
save();console.log(JSON.stringify({out,status:report.status,summary:report.summary,error:report.error}));
