import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../../../..');
const out=resolve(import.meta.dirname,'results');mkdirSync(out,{recursive:true});
const output=execFileSync(process.execPath,['scripts/validation/achievements-core.mjs'],{cwd:root,encoding:'utf8'});
writeFileSync(resolve(out,'consumer.log'),output);
const last=JSON.parse(output.trim().split('\n').at(-1));
if(last.typecheck!=='passed'||last.runtime!=='passed'||last.installedRuntimePackages.join()!=='@haiyue/native')throw Error('Isolated consumer did not pass');
const files=['npm/package.json','npm/index.ts','scripts/validation/achievements-core.mjs','desktop/README.md','desktop/host/glfw.ts','desktop/toolchains.json'];
const report={status:'passed',scope:'Existing achievements/local isolated package consumer, not all native system APIs',
  installedRuntimePackages:last.installedRuntimePackages,typecheck:last.typecheck,runtime:last.runtime,
  node:process.version,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  hashes:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')])),
  desktop:{macOSArm64:'pending-G04',windowsX64:'pending-G04',ime:'pending-G04',accessibility:'pending-G04'},
  rootEntry:'Legacy compatibility export still includes Engine; system independence applies to isolated subpaths.'};
writeFileSync(resolve(out,'baseline.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,scope:report.scope}));
