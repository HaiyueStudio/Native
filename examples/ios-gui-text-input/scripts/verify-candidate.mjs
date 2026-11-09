import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {candidateBytes} from './candidate-bytes.mjs';
const workspaceRoot=fileURLToPath(new URL('../../../../',import.meta.url));
const args=process.argv.slice(2);if(args.length>1||args.length===1&&!args[0].startsWith('--manifest='))throw Error('Use --manifest=<file> only for a named historical manifest.');
const manifest=JSON.parse(readFileSync(args.length?resolve(workspaceRoot,args[0].slice(11)):new URL('../vendor/qualified-candidate.json',import.meta.url),'utf8'));
if(!args.length&&(manifest.schemaVersion!==3||manifest.targetVersion!=='0.2.3'))throw Error('The active Native consumer requires the 0.2.3 vendor manifest.');
const root=manifest.schemaVersion===3?fileURLToPath(new URL('../../../',import.meta.url)):workspaceRoot;
const bad=[];
for(const item of manifest.files){
 try{
  const path=realpathSync(resolve(root,item.path)),part=relative(root,path);
  if(part.startsWith('..')||isAbsolute(part))throw Error('File escapes candidate root');
  const bytes=candidateBytes(item,readFileSync(path)),hash=createHash('sha256').update(bytes).digest('hex');
  if(bytes.length!==item.bytes||hash!==item.sha256)bad.push(item.path);
 }catch(error){bad.push({path:item.path,error:String(error)});}
}
console.log(JSON.stringify({status:bad.length?'failed':'verified-source-and-package-bytes',candidateId:manifest.candidateId,files:manifest.files.length,normalizedTextFiles:manifest.files.filter(item=>item.normalization==='utf8-lf').length,bad,deviceAcceptance:'pending'},null,2));
if(bad.length)process.exitCode=1;
