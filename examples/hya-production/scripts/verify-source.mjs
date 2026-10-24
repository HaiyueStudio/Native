import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(app,'artifacts','native-source-check-'+Date.now());mkdirSync(out,{recursive:true});
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex'),inputs=[];
const walk=folder=>readdirSync(folder,{withFileTypes:true}).flatMap(item=>item.name==='generated'?[]:item.isDirectory()?walk(resolve(folder,item.name)):[resolve(folder,item.name)]);
const files=['package.json','package-lock.json','qualified-candidate.json','nativescript.config.ts','tsconfig.json','webpack.config.js','Gemfile','Gemfile.lock','.ruby-version',...['src','scripts','native','test','App_Resources','hooks','locks','vendor'].flatMap(name=>walk(resolve(app,name)).map(file=>relative(app,file)))];
for(const file of files){const source=resolve(app,file),snapshot=resolve(out,'source',file);mkdirSync(dirname(snapshot),{recursive:true});copyFileSync(source,snapshot);inputs.push({path:file,sha256:sha(source)});}
const checks=[],run=(id,args)=>{
 const value=spawnSync(process.execPath,['--max-old-space-size=2048',...args],{cwd:app,encoding:'utf8',maxBuffer:16*1024*1024});
 const log=resolve(out,id+'.log');writeFileSync(log,(value.stdout??'')+(value.stderr??'')+(value.error?.stack??''));
 checks.push({id,exitCode:value.status,log:relative(app,log).replaceAll('\\','/'),sha256:sha(log)});return value.status===0;
};
let passed=run('preflight',['scripts/preflight.mjs']);
if(passed)passed=run('native-sdk-types',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false','--listFiles']);
if(passed)passed=run('public-scene-and-byte-tests',['--test','test/scene-source.test.mjs','test/sha256-capability.test.mjs','test/base64-capability.test.mjs','test/scene-resources.test.mjs']);
if(passed)passed=run('ios-javascript-bundle',['node_modules/webpack/bin/webpack.js','--config','webpack.config.js','--env','platform=ios','--env','hmr=false','--env','nativescriptLibPath','--output-path',resolve(out,'app'),'--stats','errors-warnings']);
const bridge=[];
if(checks.some(check=>check.id==='native-sdk-types'))for(const file of readFileSync(resolve(out,'native-sdk-types.log'),'utf8').split(/\r?\n/))if(file.startsWith(resolve(app,'../../bridge').replaceAll('\\','/'))||file.startsWith(resolve(app,'../../bridge'))){const snapshot=resolve(out,'native-bridge',relative(resolve(app,'../../bridge'),file));mkdirSync(dirname(snapshot),{recursive:true});copyFileSync(file,snapshot);bridge.push({path:relative(resolve(app,'../..'),file).replaceAll('\\','/'),sha256:sha(file)});}
for(const input of inputs)assert.equal(sha(resolve(app,input.path)),input.sha256,'Source changed while checks were running: '+input.path);
if(passed){
 const bundle=readFileSync(resolve(out,'app/bundle.js'),'utf8');
 for(const text of ['G11 real HYA Native scene','loadSceneResources','prepareIosByteCapabilities','createIosHyaAudioHost'])assert.ok(bundle.includes(text),'Native entry missing from actual bundle: '+text);
 const copied=JSON.parse(readFileSync(resolve(out,'app/assets/manifest.json'),'utf8'));
 for(const descriptor of Object.values(copied.assets))assert.equal(sha(resolve(out,'app/assets',descriptor.file)),descriptor.sha256);
 assert.equal(sha(resolve(out,'app/qualified-candidate.json')),sha(resolve(app,'qualified-candidate.json')));
}
const report={status:passed?'passed-native-source-types-and-ios-javascript-bundle':'failed',inputs,bridge,checks,bundled:passed,appleSdkCompiled:false,nativeScriptMetadataGenerated:false,signedNativeAppBuilt:false,physicalNativeQualified:false,fullG11Complete:false};
writeFileSync(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,status:report.status,checks:checks.map(({id,exitCode})=>({id,exitCode})),bridgeSources:bridge.length}));process.exitCode=passed?0:1;
