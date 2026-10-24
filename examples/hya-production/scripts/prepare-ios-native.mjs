import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),target=resolve(app,'App_Resources/iOS/src/generated');mkdirSync(target,{recursive:true});
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),files=[];
for(const name of ['HyaPcmMixer.hpp','HyaPcmBridge.hpp']){
 const source=resolve(app,'native',name),destination=resolve(target,name);copyFileSync(source,destination);assert.equal(sha(source),sha(destination));files.push({source,destination,sha256:sha(source)});
}
const report={status:'prepared-exact-native-audio-headers-not-sdk-built',files,nativeSdkBuild:false,physicalNativeQualified:false,fullG11Complete:false};
writeFileSync(resolve(target,'source-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
