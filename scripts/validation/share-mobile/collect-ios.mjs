import {mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const [device, destination] = process.argv.slice(2);
if (!device || !destination) throw Error('Usage: node collect-ios.mjs DEVICE OUTPUT_DIRECTORY');
mkdirSync(destination, {recursive:true});
for (const file of ['share-content-validation.jsonl','share-content-host.jsonl','share-source.png',
  'result-zh-CN-landscape.png','result-zh-CN-portrait.png','result-en-landscape.png','result-en-portrait.png',
  ...(process.argv.includes('--sheet') ? ['share-system-sheet.png'] : [])]) {
  execFileSync('xcrun',['devicectl','device','copy','from','--device',device,'--domain-type','appDataContainer',
    '--domain-identifier','org.haiyue.nativevalidation','--source','Documents/'+file,
    '--destination',path.resolve(destination,file),'--timeout','30'],
    {stdio:'inherit',env:{...process.env,DEVELOPER_DIR:process.env.DEVELOPER_DIR||'/Applications/Xcode.app/Contents/Developer'}});
}
