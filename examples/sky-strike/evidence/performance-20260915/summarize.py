import json,statistics
from pathlib import Path
root=Path('/Users/qingque/Desktop/HaiyueStudio/Native/examples/sky-strike/evidence/performance-20260915')
reports=[]
for scene in ['quantum','fire','black-hole','prism','parts']:
 p=root/(scene+'-host.jsonl')
 if not p.exists():continue
 rows=[json.loads(l) for l in p.read_text().splitlines() if l.strip()]
 presents={r['detail']['frames']:r['detail'] for r in rows if r['event']=='present'}
 allperf=[r['detail'] for r in rows if r['event']=='performance']
 measured=[d for d in allperf if d['frames']>=240 and presents.get(d['frames'],{}).get('input',{}).get('game',{}).get('phase')=='playing']
 if not measured:continue
 def mean(key):return sum(d[key]['samples']*d[key]['meanMs'] for d in measured)/sum(d[key]['samples'] for d in measured)
 games=[d.get('input',{}).get('game',{}) for d in presents.values()]
 render=[g['rendering'] for g in games if 'rendering' in g]
 report={'scene':scene,'playingSamples':sum(d['cpu']['samples'] for d in measured),'cpuMeanMs':mean('cpu'),'worstWindowCpuP95Ms':max(d['cpu']['p95Ms'] for d in measured),'intervalMeanMs':mean('interval'),'worstWindowIntervalP95Ms':max(d['interval']['p95Ms'] for d in measured),'callbackHz':1000/mean('interval'),'firstFrameCpuMs':allperf[0]['cpu']['meanMs'],'thermalStates':sorted(set(d['thermalState'] for d in allperf)),'maxSpriteCommands':max(r['drawCommands'] for r in render),'maxSpriteDrawCalls':max(r['drawCalls'] for r in render),'atlasBytes':sorted(set(r['gpuBytes'] for r in render)),'maxGuiTextureBytes':max(r['guiTextureBytes'] for r in render),'maxLensTargetBytes':max((r.get('lens') or {}).get('targetBytes',0) for r in render),'maxFlameInstances':max((r.get('fire') or {}).get('instances',0) for r in render),'maxAudioVoices':max((g.get('audio') or {}).get('backend',{}).get('voices',0) for g in games),'gpuTraceEnabled':any(d['engine']['enabled'] for d in allperf),'endPhase':games[-1].get('phase'),'gpuTimeMs':None}
 reports.append(report)
(root/'summary.json').write_text(json.dumps(reports,indent=2)+'\n');print(json.dumps(reports,indent=2))
