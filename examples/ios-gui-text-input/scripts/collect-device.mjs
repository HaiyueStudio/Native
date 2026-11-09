import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const [device,profile='g11-023',...extra]=process.argv.slice(2);if(!device||extra.length||!['g11-023','g06'].includes(profile))throw new Error('Usage: node scripts/collect-device.mjs <device identifier> [g11-023|g06]');
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=profile==='g11-023'?resolve(app,'artifacts/engine-0.2.3',`device-${Date.now()}`):resolve(app,'artifacts',`device-${Date.now()}`);mkdirSync(out,{recursive:true});
let failed=false;
for(const name of profile==='g11-023'?['g11-sessions']:['g06-text-input.jsonl','g06-host.jsonl']){
 const r=spawnSync('xcrun',['devicectl','--timeout','20','device','copy','from','--device',device,'--domain-type','appDataContainer','--domain-identifier','org.haiyue.native.iosguitextinput','--source',`Documents/${name}`,'--destination',resolve(out,name)],{cwd:app,encoding:'utf8',timeout:30000});
 writeFileSync(resolve(out,name+'.copy.json'),JSON.stringify({status:r.status,signal:r.signal,error:r.error?.message,stdout:r.stdout,stderr:r.stderr},null,2)+'\n');if(r.status!==0)failed=true;
}
console.log(`Device journal folder: ${out}`);if(failed)process.exitCode=1;
