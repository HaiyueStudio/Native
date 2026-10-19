import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../../',import.meta.url)),base=path.join(root,'artifacts/ui-validation');
const packages=JSON.parse(readFileSync(path.join(base,'packages.json')));
for(const value of Object.values(packages.packages))if(createHash('sha256').update(readFileSync(path.join(base,value.filename))).digest('hex')!==value.sha256)throw Error('Package SHA mismatch');
const work=mkdtempSync(path.join(base,'fresh-'));
const require=createRequire(path.join(base,'mobile/package.json')),esbuild=require('esbuild');
const run=(cmd,args,cwd)=>execFileSync(cmd,args,{cwd,stdio:'pipe',env:{...process.env,npm_config_cache:path.join(base,'npm-cache')}}).toString();
const results={packages:packages.packages,toolchain:{esbuild:esbuild.version},consumers:{}};
for(const name of ['system','mobile']){
  const cwd=path.join(work,name);mkdirSync(cwd);
  const dependencies={'@haiyue/native':`file:${path.join(base,packages.packages.native.filename)}`};
  if(name==='mobile')Object.assign(dependencies,{'@haiyue/ui':`file:${path.join(base,packages.packages.ui.filename)}`,'@nativescript/core':'9.1.1','@nativescript/types':'9.0.0'});
  writeFileSync(path.join(cwd,'package.json'),JSON.stringify({name:`g06-${name}-consumer`,version:'0.0.0',private:true,type:'module',dependencies},null,2));
  // Explicit peers only, matching Native's existing system-only consumer policy.
  const log=run('npm',['install','--ignore-scripts','--legacy-peer-deps','--no-audit','--no-fund'],cwd);writeFileSync(path.join(cwd,'install.log'),log);
  if(existsSync(path.join(cwd,'node_modules/@haiyue/engine')))throw Error('Engine leaked into consumer');
  if(name==='system'){
    if(existsSync(path.join(cwd,'node_modules/@haiyue/ui'))||existsSync(path.join(cwd,'node_modules/@nativescript/core')))throw Error('UI/platform leaked into system consumer');
    writeFileSync(path.join(cwd,'entry.ts'),`import {createLocalAchievementProvider} from '@haiyue/native/achievements/local';const p=createLocalAchievementProvider('g06');await p.initialize();if(p.kind!=='local'||p.getSession().state!=='guest')throw Error('Invalid provider');p.dispose();console.log('system-consumer-passed');`);
    const built=await esbuild.build({absWorkingDir:cwd,entryPoints:['entry.ts'],bundle:true,format:'esm',platform:'node',outfile:path.join(cwd,'bundle.mjs'),metafile:true});
    run(process.execPath,['bundle.mjs'],cwd);results.consumers.system={status:'passed',inputs:Object.keys(built.metafile.inputs),uiInstalled:false,engineInstalled:false};
  }else{
    writeFileSync(path.join(cwd,'entry.ts'),`import {GridLayout} from '@nativescript/core';import {HYNativeScriptRenderer} from '@haiyue/native/ui';import {HYPage} from '@haiyue/ui/portable';import {hyNode} from '@haiyue/ui/core';export function create(host:GridLayout){const page=new HYPage(new HYNativeScriptRenderer(host));page.mount(hyNode('Button','button',{text:'Hello'}));return page;}`);
    writeFileSync(path.join(cwd,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,skipLibCheck:true,noEmit:true,target:'ES2020',module:'esnext',moduleResolution:'bundler',types:['@nativescript/types'],lib:['ES2022','DOM']},include:['entry.ts','node_modules/@haiyue/native/bridge/ui/**/*.ts']}));
    run(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'--noEmit','-p','tsconfig.json'],cwd);
    // Bundle adapter + portable code while leaving the platform runtime as a host external.
    const built=await esbuild.build({absWorkingDir:cwd,entryPoints:['entry.ts'],bundle:true,format:'esm',platform:'neutral',external:['@nativescript/core'],outfile:path.join(cwd,'bundle.mjs'),metafile:true});
    const inputs=Object.keys(built.metafile.inputs);
    if(inputs.some(file=>file.includes('@haiyue/engine')||file.includes('adapters/web')||file.includes('components/')))throw Error('Unexpected rendering/browser dependency');
    results.consumers.mobile={status:'passed',inputs,engineInstalled:false,webAdapterBundled:false};
  }
}
writeFileSync(path.join(base,'consumer-results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({status:'passed',directory:work}));
