import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app = fileURLToPath(new URL('..', import.meta.url));
const adb = path.resolve(app, '../../.android-tools/sdk/platform-tools/adb');
const pkg = 'org.haiyue.games.boxbound';
const listed = spawnSync(adb, ['devices'], { encoding:'utf8' });
const devices = listed.stdout.trim().split('\n').slice(1).filter(s=>/\sdevice$/.test(s)).map(s=>s.split(/\s/)[0]);
const serial = process.env.BOXBOUND_ANDROID_SERIAL ?? (devices.length === 1 ? devices[0] : null);
if (!serial) throw Error('Set BOXBOUND_ANDROID_SERIAL when there is not exactly one authorized device.');
function run(args, capture = false) {
  const r=spawnSync(adb,['-s',serial,...args],{maxBuffer:32*1024*1024});
  if(r.status !== 0) throw Error(r.stderr?.toString() || `adb exited ${r.status}`);
  if(!capture && r.stdout.length) process.stdout.write(r.stdout);
  return r.stdout;
}
function save(file, bytes) { const target=path.resolve(app,file); mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes);console.log(`Saved ${target}`); }
const actions = process.argv[2] === 'batch' ? JSON.parse(readFileSync(process.argv[3],'utf8')) : [{ action:process.argv[2], args:process.argv.slice(3) }];
for (const {action,args=[]} of actions) {
  if(action==='install') run(['install','-r',path.resolve(app,'platforms/android/app/build/outputs/apk/debug/app-debug.apk')]);
  else if(action==='launch') run(['shell','am','start','-n',`${pkg}/com.tns.NativeScriptActivity`,...(args.some(x=>x==='smoke'||x==='profile'||x==='stress')?['--ez','BOXBOUND_SMOKE','true',...(args.includes('profile')?['--ez','BOXBOUND_PROFILE','true']:[]),...(args.includes('stress')?['--ez','BOXBOUND_STRESS','true']:[])]:[])]);
  else if(action==='stop') run(['shell','am','force-stop',pkg]);
  else if(action==='home') run(['shell','input','keyevent','KEYCODE_HOME']);
  else if(action==='back') run(['shell','input','keyevent','KEYCODE_BACK']);
  else if(action==='tap') run(['shell','input','tap',...args.map(String)]);
  else if(action==='swipe') run(['shell','input','swipe',...args.map(String)]);
  else if(action==='capture') save(args[0],run(['exec-out','screencap','-p'],true));
  else if(action==='journal') save(args[0],run(['exec-out','run-as',pkg,'cat','files/boxbound-host.jsonl'],true));
  else if(action==='dump') { run(['shell','uiautomator','dump','/sdcard/boxbound-ui.xml']); save(args[0],run(['exec-out','cat','/sdcard/boxbound-ui.xml'],true)); }
  else if(action==='wait') await new Promise(resolve=>setTimeout(resolve,Math.min(10000,Number(args[0]))));
  else throw Error(`Unknown device action: ${action}`);
}
