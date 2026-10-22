import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

export const applicationInputs=['src','App_Resources','hooks','nativescript.config.ts','webpack.config.js','tsconfig.json','Gemfile'];
export const sha256=data=>createHash('sha256').update(data).digest('hex');
export function snapshot(root,inputs) {
  const files={};
  const visit=file=>{
    const full=path.join(root,file);
    if(statSync(full).isDirectory())for(const child of readdirSync(full).sort())visit(path.join(file,child));
    else files[file]=sha256(readFileSync(full));
  };
  for(const input of [...inputs].sort())visit(input);
  return {sha256:sha256(JSON.stringify(files)),files};
}
