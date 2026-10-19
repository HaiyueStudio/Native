import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {applicationInputs,snapshot,sha256} from '../../examples/ui-validation/mobile/identity.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const args=process.argv.slice(2),at=args.indexOf('--profile'),profile=at<0?'core':args[at+1];
const run=(command,args)=>{const r=spawnSync(command,args,{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);};
function currentPackages() {
  const pack=path.join(root,'artifacts/ui-validation/packages.json');
  if(!existsSync(pack))throw Error('Prepare the SHA-pinned mobile consumer first; see examples/ui-validation/mobile/README.md');
  const identity=JSON.parse(readFileSync(pack));
  if(identity.nativeUI?.sha256!==snapshot(root,['bridge/ui','npm/package.json']).sha256)throw Error('Stale native UI package; rerun prepare');
  for(const dir of ['examples/ui-validation/mobile','artifacts/ui-validation/mobile'])
    if(identity.application?.sha256!==snapshot(path.join(root,dir),applicationInputs).sha256)throw Error(`Stale application inputs: ${dir}; rerun prepare`);
  for(const pkg of Object.values(identity.packages))
    if(sha256(readFileSync(path.join(root,'artifacts/ui-validation',pkg.filename)))!==pkg.sha256)throw Error(`Package hash mismatch: ${pkg.filename}`);
  const provenance=JSON.parse(readFileSync(path.join(root,'artifacts/ui-validation/mobile/node_modules/@haiyue/native/provenance.json')));
  for(const [file,sha] of Object.entries(provenance.files))if(file.startsWith('bridge/ui/')&&createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')!==sha)throw Error(`Stale staged package: ${file}; rerun prepare before verification`);
  return identity;
}
if(profile==='core'){
  currentPackages();
  run(process.execPath,['--test','test/ui/nativescript/adapter.test.mjs','test/ui/nativescript/native-callback.test.mjs','test/ui/nativescript/native-runtime.test.mjs']);
  run(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','-p','artifacts/ui-validation/mobile/tsconfig.json']);
}else if(profile==='consumer'||profile==='fresh'){
  currentPackages();
  run(process.execPath,['examples/ui-validation/mobile/consumer.mjs']);
}else if(profile==='mobile'){
  const {packages,application}=currentPackages();
  const evidence=path.join(root,'review/m24-ui/g06/devices.json');
  const report=existsSync(evidence)?JSON.parse(readFileSync(evidence)):{};
  const required=['iphone','ipad','android'];
  const pending=required.filter(name=>report[name]?.status!=='passed'||report[name]?.packageSha256!==packages.native.sha256||report[name]?.uiPackageSha256!==packages.ui.sha256||report[name]?.applicationSha256!==application.sha256);
  if(pending.length){console.error(JSON.stringify({status:'pending-device',required:pending}));process.exit(2);}
  console.log(JSON.stringify({status:'passed',profile}));
}else if(profile==='desktop'){
  console.error(JSON.stringify({status:'unsupported',reason:'Desktop adapter belongs to G08, not the mobile backend'}));process.exit(2);
}else throw Error(`Unknown UI profile: ${profile}`);
