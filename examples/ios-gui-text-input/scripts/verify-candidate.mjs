import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('../qualified-candidate.json',import.meta.url),'utf8'));
const bad=[];
for(const item of manifest.files){
 try{
  const path=realpathSync(resolve(root,item.path)),part=relative(root,path);
  if(part.startsWith('..')||isAbsolute(part))throw Error('File escapes candidate root');
  const bytes=readFileSync(path),hash=createHash('sha256').update(bytes).digest('hex');
  if(bytes.length!==item.bytes||hash!==item.sha256)bad.push(item.path);
 }catch(error){bad.push({path:item.path,error:String(error)});}
}
console.log(JSON.stringify({status:bad.length?'failed':'verified-source-and-package-bytes',files:manifest.files.length,bad,deviceAcceptance:'pending'},null,2));
if(bad.length)process.exitCode=1;
