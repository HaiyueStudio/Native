import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const app = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer' };
const [device, mode, ...args] = process.argv.slice(2);
if (!device || !mode) throw Error('Usage: node scripts/device-ios.mjs DEVICE install|launch|journal|capture|splash|batch [args]');
const pkg = 'org.haiyue.games.boxbound';
function run(args) { const r=spawnSync('xcrun',['devicectl','--timeout','60',...args],{env,stdio:'inherit'}); if(r.error)throw r.error;if(r.status!==0)throw Error(`devicectl exited ${r.status}`); }
function copy(source, target) { const destination=path.resolve(app,target);mkdirSync(path.dirname(destination),{recursive:true});run(['device','copy','from','--device',device,'--domain-type','appDataContainer','--domain-identifier',pkg,'--source',`Documents/${source}`,'--destination',destination]); }
const steps=mode==='batch'?JSON.parse(readFileSync(args[0],'utf8')):[{action:mode,args}];
for(const {action,args=[]} of steps) {
 if(action==='install') {const build=path.join(app,'platforms/ios/build/Debug-iphoneos');const bundle=[path.join(build,'boxbound.app'),path.join(build,'boxbound.xcarchive/Products/Applications/boxbound.app')].find(existsSync);if(!bundle)throw Error(`Build first: ${build}`);run(['device','install','app','--device',device,bundle]);}
 else if(action==='launch') run(['device','process','launch','--device',device,'--terminate-existing',...(args.includes('transitions')?['--environment-variables','{"BOXBOUND_SMOKE":"1","BOXBOUND_TRANSITIONS":"1"}']:args.includes('smoke')?['--environment-variables','{"BOXBOUND_SMOKE":"1"}']:[]),pkg]);
 else if(action==='journal') copy('boxbound-host.jsonl',args[0]);
 else if(action==='capture') copy('boxbound-frame.png',args[0]);
 else if(action==='game-capture') copy('boxbound-game.png',args[0]);
 else if(action==='wait') await new Promise(resolve=>setTimeout(resolve,Math.min(Number(args[0]),10000)));
 else throw Error(`Unknown action: ${action}`);
}
