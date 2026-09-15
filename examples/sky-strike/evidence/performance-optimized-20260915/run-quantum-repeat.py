import subprocess,time,json,os,sys
from pathlib import Path
out=Path('/Users/qingque/Desktop/HaiyueStudio/Native/examples/sky-strike/evidence/performance-optimized-20260915/repeat-quantum');out.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,DEVELOPER_DIR='/Applications/Xcode.app/Contents/Developer')
device='8D9238D1-024A-538B-A175-B9E71AA32202';bundle='org.haiyue.native.skystrike'
def call(args,log):
 with (out/log).open('w') as f:r=subprocess.run(['xcrun','devicectl','--timeout','25',*args],env=env,stdout=f,stderr=subprocess.STDOUT,timeout=40)
 if r.returncode:raise RuntimeError(log+' failed: '+(out/log).read_text()[-1400:])
for name,mode,seconds in [('quantum','SKY_QUANTUM_PROBE',28)]:
 started=time.time();print('Starting '+name,flush=True)
 call(['device','process','launch','--device',device,'--terminate-existing','--environment-variables',json.dumps({'SKY_PERF':'1',mode:'1'}),bundle],name+'-launch.log')
 time.sleep(seconds)
 dest=out/(name+'-host.jsonl')
 call(['device','copy','from','--device',device,'--domain-type','appDataContainer','--domain-identifier',bundle,'--source','Documents/sky-strike-host.jsonl','--destination',str(dest)],name+'-copy.log')
 rows=[json.loads(l) for l in dest.read_text().splitlines() if l.strip()]
 assert rows[0]['time']/1000>=started-2,'Stale host data'
 perf=[r for r in rows if r['event']=='performance']
 assert len(perf)>=3,'Too few performance windows'
 assert any(r['event']=='present' and r['detail'].get('input',{}).get('game',{}).get('phase')=='paused' for r in rows),'Scene did not finish before capture'
 print(json.dumps({'scene':name,'windows':len(perf),'last':perf[-1]['detail'].get('thermalState')}),flush=True)
call(['device','process','launch','--device',device,'--terminate-existing','--environment-variables',json.dumps({'SKY_PERF':'0'}),bundle],'normal-launch.log')
print('All scenes complete; normal launch restored.',flush=True)
