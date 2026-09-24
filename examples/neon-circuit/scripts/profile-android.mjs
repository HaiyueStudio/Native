import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('..',import.meta.url));
const args=process.argv.slice(2), option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const serial=option('--device',process.env.ANDROID_SERIAL);
if(!serial)throw new Error('Pass --device <serial> or ANDROID_SERIAL.');
const profiles=option('--profiles','simple,batched').split(',');
if(profiles.some(p=>!['simple','batched','gpu-driven'].includes(p)))throw new Error('Unknown render profile.');
const directory=path.resolve(app,option('--output','artifacts/android-performance'));
const adb=process.env.ADB || path.resolve(app,'../../.android-tools/sdk/platform-tools/adb');
const command=(...commandArgs)=>{
  const result=spawnSync(adb,['-s',serial,...commandArgs],{encoding:'utf8',timeout:10000});
  if(result.error || result.status!==0)throw new Error(result.error?.message || result.stderr || `adb exit ${result.status}`);
  return result.stdout;
};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
mkdirSync(directory,{recursive:true});const summary=[];
try {
  for(const profile of profiles){
    const started=Date.now();
    let previousLaunch=null;
    try {previousLaunch=JSON.parse(command('shell','run-as','org.haiyue.games.neoncircuit','cat','files/neon-circuit-host.jsonl').split('\n')[0]).time;} catch {}
    command('shell','am','start','-S','-n','org.haiyue.games.neoncircuit/com.tns.NativeScriptActivity','--ez','NEON_PERF','true','--ez','NEON_BENCHMARK','true','--ez','NEON_RACE','true','--es','NEON_RENDER_PROFILE',profile);
    let records=[];
    while(Date.now()-started<90000){
      await pause(3000);
      const source=command('shell','run-as','org.haiyue.games.neoncircuit','cat','files/neon-circuit-host.jsonl');
      records=source.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
      // Ignore a previous launch's journal while the new process initializes.
      if(!records.some(r=>r.event==='host-created' && r.time!==previousLaunch))continue;
      writeFileSync(path.join(directory,`${profile}.jsonl`),source);
      const failure=records.find(r=>/failed|error/.test(r.event));if(failure)throw new Error(JSON.stringify(failure));
      if(records.some(r=>r.event==='performance' && r.detail.frames>=960))break;
    }
    const samples=records.filter(r=>r.event==='performance' && r.detail.frames>=360 && r.detail.frames<=960).map(r=>r.detail);
    if(samples.length!==6)throw new Error(`${profile}: incomplete warm sample windows (${samples.length}/6).`);
    const poses=records.filter(r=>r.event==='present' && r.detail.frames>=360 && r.detail.frames<=960).map(r=>r.detail.input.game);
    if(poses.some(g=>g.phase!=='racing' || g.speed!==0 || g.progress!==0))throw new Error(`${profile}: reference pose is not stationary; verify the profiling build and launch flags.`);
    const weighted=(field,key)=>samples.reduce((s,d)=>s+d[field][key]*d[field].samples,0)/samples.reduce((s,d)=>s+d[field].samples,0);
    const result={profile,windows:6,frames:720,meanCpuMs:weighted('cpu','meanMs'),meanIntervalMs:weighted('interval','meanMs'),worstWindowP95Ms:Math.max(...samples.map(d=>d.interval.p95Ms)),detailedDiagnostics:samples.some(d=>d.engine.enabled),pose:poses[0],estimatedFps:1000/weighted('interval','meanMs')};
    summary.push(result);writeFileSync(path.join(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');
    console.log(JSON.stringify({profile,cpu:result.meanCpuMs,interval:result.meanIntervalMs,fps:result.estimatedFps,worstWindowP95:result.worstWindowP95Ms}));
  }
} finally {
  // Return to ordinary play with no synthetic launch parameters, including on failure.
  command('shell','am','start','-S','-n','org.haiyue.games.neoncircuit/com.tns.NativeScriptActivity');
}
