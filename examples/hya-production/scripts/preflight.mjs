import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const read=file=>JSON.parse(readFileSync(resolve(app,file),'utf8')),candidate=read('qualified-candidate.json'),assets=read('src/assets/manifest.json'),pkg=read('package.json');
const checks=[];
for(const item of candidate.packages){assert.equal(sha(resolve(app,item.path)),item.sha256);assert.equal(pkg.dependencies[item.name],'file:'+item.path);checks.push({id:item.name,sha256:item.sha256});}
for(const [id,item]of Object.entries(assets.assets)){assert.equal(readFileSync(resolve(app,'src/assets',item.file)).byteLength,item.bytes);assert.equal(sha(resolve(app,'src/assets',item.file)),item.sha256);checks.push({id,sha256:item.sha256});}
assert.equal(sha(resolve(app,'src/assets',assets.scene.file)),assets.scene.sha256);
assert.equal(sha(resolve(app,'scripts',assets.generator.file)),assets.generator.sha256);
assert.equal(typeof candidate.formalSharedAdmission,'boolean');assert.equal(candidate.physicalNativeQualified,false);
if(candidate.formalSharedAdmission){
 const reportFile=resolve(app,candidate.source.report);assert.equal(sha(reportFile),candidate.source.sha256);
 const report=JSON.parse(readFileSync(reportFile,'utf8'));
 assert.equal(report.gate?.status,'passed');assert.equal(report.sourceState?.workingTreeDirty,false);
 assert.equal(report.sourceState.revision,candidate.source.revision);assert.equal(candidate.packageBudgetsPassed,true);
 for(const item of candidate.packages){const entry=report.packages.find(p=>p.name===item.name);assert.ok(entry,'Missing public package receipt');assert.equal(entry.sha256,item.sha256);assert.equal(entry.version,'0.2.2');}
 checks.push({id:'same-clean-public-package-admission',revision:report.sourceState.revision,sha256:candidate.source.sha256});
}
const locked=existsSync(resolve(app,'package-lock.json'));
if(locked){const lock=read('package-lock.json');for(const item of candidate.packages)assert.equal(lock.packages['node_modules/'+item.name].integrity,item.integrity);}
let nativeHead='unknown';try{nativeHead=execFileSync('git',['-c','safe.directory='+resolve(app,'../..').replaceAll('\\','/'),'rev-parse','HEAD'],{cwd:app,encoding:'utf8'}).trim();}catch{}
const report={status:'passed-source-preflight',nativeHead,checks,scene:assets.scene.sha256,locked,appleSdkCompiled:false,physicalNativeQualified:false,fullG11Complete:false};
const out=resolve(app,'artifacts','source-preflight-'+Date.now());mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out,...report},null,2));
