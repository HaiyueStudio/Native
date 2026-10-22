import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(app,'artifacts',`preflight-${Date.now()}`);mkdirSync(out,{recursive:true});
const run=(command,args)=>{console.log(`Collecting ${command} ${args.join(' ')} ...`);const r=spawnSync(command,args,{cwd:app,encoding:'utf8',timeout:30000});return {command,args,status:r.status,signal:r.signal,error:r.error?.message,stdout:r.stdout,stderr:r.stderr};};
const checks=process.platform==='darwin'?[
 run('sw_vers',[]),run('uname',['-m']),run('npm',['--version']),run('xcode-select',['-p']),run('xcodebuild',['-version']),run('xcodebuild',['-showsdks']),
 run('xcrun',['devicectl','list','devices','--json-output',resolve(out,'devices.json')]),run('ruby',['--version']),run('bundle',['--version']),
]:[];
const report={schemaVersion:1,status:process.platform==='darwin'&&checks.every(c=>c.status===0)?'preflight-recorded':'needs-setup',time:new Date().toISOString(),platform:process.platform,arch:process.arch,node:process.version,checks,qualification:'Environment inventory only. Confirm the iPhone is available in devices.json; this is not a build or device acceptance.'};
const file=resolve(out,'preflight.json');writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(`${report.status}: ${file}`);
if(report.status!=='preflight-recorded')process.exitCode=1;
