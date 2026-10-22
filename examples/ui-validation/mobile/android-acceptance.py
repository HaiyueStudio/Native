"""Physical Android smoke checks. ADB text injection is NOT Chinese IME acceptance."""
import argparse, json, re, subprocess, time, xml.etree.ElementTree as ET
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--adb',required=True);p.add_argument('--serial',required=True)
p.add_argument('--output',required=True);p.add_argument('--phase',choices=['controls','input','lifecycle','cycles'],required=True)
a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
app='org.haiyue.uivalidation'
def adb(*args):
    return subprocess.check_output([a.adb,'-s',a.serial,*args],timeout=30)
def tree():
    raw=adb('exec-out','uiautomator','dump','/dev/tty').decode()
    root=ET.fromstring(raw[raw.index('<?xml'):raw.index('</hierarchy>')+12])
    assert any(n.get('package')==app for n in root.iter('node')), 'Validation app is not in foreground'
    return root
def node(key,attribute='resource-id'):
    return next(n for n in tree().iter('node') if n.get(attribute)==key)
def tap(key,attribute='resource-id'):
    # Dismissing an IME/modal can move controls after the first hierarchy dump.
    # Require stable bounds before dispatching, then assert the effect at each call site.
    previous=None
    for _ in range(5):
        n=node(key,attribute);assert n.get('enabled')=='true'
        if n.get('bounds')==previous:break
        previous=n.get('bounds')
    else:raise AssertionError('Control did not settle: '+key)
    x,y,r,b=map(int,re.findall(r'\d+',n.get('bounds')))
    assert r>x and b>y, 'Control has no hit area: '+key
    print('tap',key,n.get('bounds'),flush=True)
    adb('shell','input','tap',str((x+r)//2),str((y+b)//2))
def state():
    return json.loads(adb('exec-out','run-as',app,'cat','files/ui-validation.json'))
def wait(check):
    end=time.monotonic()+15
    while time.monotonic()<end:
        d=state()
        if check(d):return d
        time.sleep(.2)
    raise AssertionError('State predicate failed: '+json.dumps(d['state'],ensure_ascii=False))
def capture(name):
    root=tree();(out/(name+'.xml')).write_text(ET.tostring(root,encoding='unicode'))
    (out/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
    (out/(name+'.json')).write_text(json.dumps(state(),ensure_ascii=False,indent=2)+'\n')
    print(name, 'passed',flush=True)

if a.phase=='controls':
    before=state()['state']['count'];tap('/screen/toolbar/increment');wait(lambda d:d['state']['count']==before+1);capture('01-counter')
    status=node('/screen/status');assert status.get('content-desc')==status.get('text'), 'Stale accessible text'
    for i in range(2):
        tap('/screen/toolbar/dialog');wait(lambda d:d['state']['dialog']);node('/screen/modal/close')
        if i==0:capture('02-modal')
        tap('/screen/modal/close');wait(lambda d:not d['state']['dialog'])
    tap('/screen/toolbar/dialog')
    for i in range(3):
        if not state()['state']['dialog']:break
        adb('shell','input','keyevent','4');time.sleep(.4)
    wait(lambda d:not d['state']['dialog']);capture('03-modal-back')
    quality='/screen/scroll/body/tabs/settings/grid/quality'
    tap(quality);tap('50%','text');wait(lambda d:d['state']['quality']=='50')
    tap(quality);tap('Cancel','text');wait(lambda d:d['state']['quality']=='50');capture('04-select-cancel')
    before=state()['state']['enabled'];tap('/screen/scroll/body/tabs/settings/grid/enabled');wait(lambda d:d['state']['enabled']!=before)
    tap('预览','text');wait(lambda d:d['state']['tab']=='preview');capture('05-tabs')
    tap('设置','text');wait(lambda d:d['state']['tab']=='settings')
elif a.phase=='input':
    before=state()['state']['title']
    tap('/screen/scroll/body/name/title')
    # Wait for native focus/IME activation before fast ADB key injection.
    field=node('/screen/scroll/body/name/title');assert field.get('focused')=='true'
    # This Chinese IME buffers hardware letters in its candidate window. Enter
    # confirms that candidate; only subsequent blur is expected to commit the app value.
    adb('shell','input','text','Test');adb('shell','input','keyevent','66')
    assert 'Test' in node('/screen/scroll/body/name/title').get('text',''), 'Injected text did not reach the field'
    # ADB keyevent ENTER is not equivalent to this device's IME action. Verify the
    # defined blur commit path; real keyboard candidate/Done acceptance stays separate.
    tap('/screen/scroll/body/source')
    wait(lambda d:d['state']['title']!=before and 'Test' in d['state']['title']);capture('06-english-input')
    adb('shell','input','keyevent','4')
elif a.phase=='lifecycle':
    old={key:adb('shell','settings','get','system',key).decode().strip() for key in ['accelerometer_rotation','user_rotation']}
    accepted=state()['state'].copy()
    try:
        adb('shell','settings','put','system','accelerometer_rotation','0')
        adb('shell','settings','put','system','user_rotation','1');time.sleep(2);capture('07-landscape')
        assert tree().get('rotation') in ['1','3']
        adb('shell','input','keyevent','3');time.sleep(1)
        adb('shell','am','start','-W','-n',app+'/com.tns.NativeScriptActivity');capture('08-resume')
        assert state()['state']==accepted
    finally:
        for key,value in old.items():
            if value=='null':adb('shell','settings','delete','system',key)
            else:adb('shell','settings','put','system',key,value)
        restored={key:adb('shell','settings','get','system',key).decode().strip() for key in old}
        (out/'rotation-restored.json').write_text(json.dumps({'before':old,'after':restored},indent=2)+'\n')
        assert restored==old, 'Device rotation settings were not restored'
elif a.phase=='cycles':
    previous=state()['time']
    (out/'memory-before.txt').write_bytes(adb('shell','dumpsys','meminfo',app))
    tap('/screen/toolbar/cycles');d=wait(lambda d:d['time']!=previous and d['state']['status']=='50 次清理通过')
    retired=d['diagnostics'][-50:]
    assert [row['cycle'] for row in retired]==list(range(50))
    assert all(not any(row[k] for k in ['activeNodes','activeListeners','activeResources','activeTimers']) for row in retired)
    capture('09-fifty-cycles')
    (out/'memory-after.txt').write_bytes(adb('shell','dumpsys','meminfo',app))
print(json.dumps({'phase':a.phase,'status':'passed'}),flush=True)
