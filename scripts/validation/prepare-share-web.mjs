import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=path.join(root,'artifacts/share-web');mkdirSync(output,{recursive:true});
for(const name of ['types','share-content','share-content.web']) {
 const source=readFileSync(path.join(root,`bridge/share/${name}.ts`),'utf8');
 const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText
  .replace(/from '(\.\/[^']+)'/g,(_m,p)=>`from '${p}.js'`);
 writeFileSync(path.join(output,`${name}.js`),result);
}
copyFileSync(path.join(root,'scripts/validation/web-share/index.html'),path.join(output,'index.html'));
console.log(output);
