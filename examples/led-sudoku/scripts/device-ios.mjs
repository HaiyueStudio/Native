import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const app = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer' };
const [device, mode, ...args] = process.argv.slice(2);
if (!device || !mode) throw Error('Usage: node scripts/device-ios.mjs DEVICE install|launch|journal|capture|splash|batch [args]');
const pkg = 'org.haiyue.games.ledsudoku';
function run(args) { const r=spawnSync('xcrun',['devicectl','--timeout','60',...args],{env,stdio:'inherit'}); if(r.error)throw r.error;if(r.status!==0)throw Error(`devicectl exited ${r.status}`); }
function copy(source, target) { const destination=path.resolve(app,target);mkdirSync(path.dirname(destination),{recursive:true});run(['device','copy','from','--device',device,'--domain-type','appDataContainer','--domain-identifier',pkg,'--source',`Documents/${source}`,'--destination',destination]); }
const steps=mode==='batch'?JSON.parse(readFileSync(args[0],'utf8')):[{action:mode,args}];
for(const {action,args=[]} of steps) {
 if(action==='install') {const bundle=path.join(app,'platforms/ios/build/Debug-iphoneos/ledsudoku.app');if(!existsSync(bundle))throw Error(`Build first: ${bundle}`);run(['device','install','app','--device',device,bundle]);}
 else if(action==='launch') run(['device','process','launch','--device',device,'--terminate-existing',...(args.includes('smoke')?['--environment-variables','{"LED_SMOKE":"1"}']:args.includes('capture')?['--environment-variables','{"LED_CAPTURE":"1"}']:[]),pkg]);
 else if(action==='journal') copy('led-sudoku-host.jsonl',args[0]);
 else if(action==='capture') {copy('led-sudoku-screen.png',`${args[0]}/screen.png`);copy('led-sudoku-board.png',`${args[0]}/board.png`);}
 else if(action==='ui') { for(const name of ['english','settings','dropdown','rule-help']) copy(`led-sudoku-${name}.png`,`${args[0]}/${name}.png`); }
 else if(action==='hints') { for(const name of ['start','inequality','box','conclusion','elimination']) copy(`led-sudoku-hint-${name}.png`,`${args[0]}/${name}.png`); }
 else if(action==='splash') copy('led-sudoku-engine-splash.png',args[0]);
 else if(action==='wait') await new Promise(resolve=>setTimeout(resolve,Math.min(Number(args[0]),10000)));
 else throw Error(`Unknown action: ${action}`);
}
