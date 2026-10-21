// Isolated source-only development consumer. UI must come from an audited npm-pack artifact.
import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {applicationInputs,snapshot} from './identity.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
if(!args.includes('--ui')||!args.includes('--sha256')||!args.includes('--modules'))throw Error('Pass --ui <G05 tarball> --sha256 <audited hash> --modules <NativeScript toolchain node_modules>');
const source=path.resolve(arg('--ui')),sha=createHash('sha256').update(readFileSync(source)).digest('hex');
if(sha!==arg('--sha256'))throw Error('UI tarball SHA-256 mismatch');
const modules=path.resolve(arg('--modules')),output=path.join(root,'artifacts/ui-validation'),host=path.join(output,'mobile');
mkdirSync(output,{recursive:true});
const ui=path.join(output,'ui-package');rmSync(ui,{recursive:true,force:true});mkdirSync(ui);
execFileSync('tar',['-xzf',source,'--strip-components=1','-C',ui]);
const uiPackage=JSON.parse(readFileSync(path.join(ui,'package.json')));
const sourceVersion=uiPackage.version;
if(!uiPackage.exports['./core']||!uiPackage.exports['./portable'])throw Error('UI artifact lacks G03 subpaths');
// Published UI 0.2.0 does NOT contain this API. Give the private copy an unambiguous prerelease identity.
uiPackage.version='0.2.0-m24.7';uiPackage.private=true;delete uiPackage.scripts;
writeFileSync(path.join(ui,'package.json'),JSON.stringify(uiPackage,null,2)+'\n');
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,stdio:'pipe',env:{...process.env,npm_config_cache:path.join(root,'artifacts/ui-npm-cache')}}).toString();
run(process.execPath,[path.join(root,'npm/stage-development.mjs')]);
const native=path.join(root,'artifacts/native-development-package');
const nativePkg=JSON.parse(readFileSync(path.join(native,'package.json')));nativePkg.version='0.1.4-m24.22';writeFileSync(path.join(native,'package.json'),JSON.stringify(nativePkg,null,2)+'\n');
const uiPack=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',output],ui))[0];
const nativePack=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',output],native))[0];
mkdirSync(path.join(host,'node_modules/@haiyue'),{recursive:true});
for(const name of readdirSync(modules))if(name!=='@haiyue'&&name!=='.bin'){
  const dest=path.join(host,'node_modules',name);if(!existsSync(dest))symlinkSync(path.join(modules,name),dest,'dir');
}
for(const [name,pack] of [['ui',uiPack],['native',nativePack]]){
  const dest=path.join(host,'node_modules/@haiyue',name);rmSync(dest,{recursive:true,force:true});mkdirSync(dest);
  execFileSync('tar',['-xzf',path.join(output,pack.filename),'--strip-components=1','-C',dest]);
}
const sourceDir=fileURLToPath(new URL('.',import.meta.url));
for(const name of applicationInputs){rmSync(path.join(host,name),{recursive:true,force:true});cpSync(path.join(sourceDir,name),path.join(host,name),{recursive:true});}
const pkg={name:'haiyue-ui-validation',version:'0.0.1',private:true,main:'src/app.ts',dependencies:{'@nativescript/core':'9.1.1','@haiyue/native':`file:../${nativePack.filename}`,'@haiyue/ui':`file:../${uiPack.filename}`},devDependencies:{'@nativescript/ios':'9.0.3','@nativescript/android':'9.0.3','@nativescript/types':'9.0.0','@nativescript/webpack':'5.0.38',nativescript:'9.1.1',typescript:'5.7.3'}};
writeFileSync(path.join(host,'package.json'),JSON.stringify(pkg,null,2)+'\n');
const evidence={sourceUI:{file:source,sha256:sha,version:sourceVersion},packages:{}};
evidence.application=snapshot(sourceDir,applicationInputs);
evidence.nativeUI=snapshot(root,['bridge/ui','npm/package.json']);
for(const [key,pack] of [['ui',uiPack],['native',nativePack]])evidence.packages[key]={filename:pack.filename,sha256:createHash('sha256').update(readFileSync(path.join(output,pack.filename))).digest('hex'),size:pack.size,unpackedSize:pack.unpackedSize};
writeFileSync(path.join(output,'packages.json'),JSON.stringify(evidence,null,2)+'\n');console.log(host);
