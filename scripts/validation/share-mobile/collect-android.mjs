import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const [device,destination]=process.argv.slice(2);
if(!device||!destination)throw Error('Usage: node collect-android.mjs DEVICE OUTPUT_DIRECTORY');
const adb=process.env.ADB||fileURLToPath(new URL('../../../.android-tools/sdk/platform-tools/adb',import.meta.url));
mkdirSync(destination,{recursive:true});
for(const file of ['share-content-validation.jsonl','share-content-host.jsonl','share-source.png',
 'result-zh-CN-landscape.png','result-zh-CN-portrait.png','result-en-landscape.png','result-en-portrait.png',
 'share-ready.png','share-image-sheet.png','share-text-sheet.png','share-english-portrait.png',
 'share-landscape-sheet.png','share-after-resume.png','share-ui-result.txt','share-chooser.txt']) {
 const bytes=execFileSync(adb,['-s',device,'exec-out','run-as','org.haiyue.nativevalidation','cat','files/'+file],{maxBuffer:16*1024*1024});
 writeFileSync(path.join(destination,file),bytes);console.log(file);
}
