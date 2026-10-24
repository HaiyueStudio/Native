import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),input=resolve(process.argv[2]);
const hash=(bytes,kind='sha256')=>createHash(kind).update(bytes).digest(kind==='sha512'?'base64':'hex');
const raw=readFileSync(input),source=JSON.parse(raw);assert.equal(source.status,'passed-five-entry-formal-build-package-consumer');
mkdirSync(resolve(app,'vendor'),{recursive:true});const packages=[];
for(const [key,name] of [['engineTarball','engine'],['formatTarball','animation-spec'],['tarball','extensions']]){
 const descriptor=source[key],bytes=readFileSync(descriptor.path);assert.equal(hash(bytes),descriptor.sha256);
 const path='vendor/haiyue-'+name+'-g11-'+descriptor.sha256.slice(0,12)+'.tgz',target=resolve(app,path);
 if(existsSync(target))assert.equal(hash(readFileSync(target)),descriptor.sha256);else copyFileSync(descriptor.path,target);
 packages.push({name:'@haiyue/'+name,path,bytes:bytes.length,sha256:descriptor.sha256,integrity:'sha512-'+hash(bytes,'sha512')});
}
const candidate={schemaVersion:1,goal:'g11-hya-production-runtime',status:'review-candidate-not-device-qualified',source:{report:basename(dirname(input))+'/result.json',sha256:hash(raw)},packages,formalSharedAdmission:false,packageBudgetsPassed:false,physicalNativeQualified:false,fullG11Complete:false};
writeFileSync(resolve(app,'qualified-candidate.json'),JSON.stringify(candidate,null,2)+'\n');console.log(JSON.stringify(candidate,null,2));
