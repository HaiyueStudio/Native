"""Audit real G04 logs. Missing gestures/recording stay pending; unit tests are separate."""
import argparse
import json
import math
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('journal', type=Path)
parser.add_argument('--recording', type=Path)
args = parser.parse_args()
events = [json.loads(line) for line in args.journal.read_text().splitlines() if line.strip()]
identity = [1 if i % 5 == 0 else 0 for i in range(16)]
violations, samples, resumes = [], [], []
last_suspend = None
for event_index, event in enumerate(events):
    kind, detail = event['event'], event['detail'] or {}
    if 'error' in kind or kind == 'device-lost':
        violations.append({'event': kind, 'time': event['time']})
    candidates = [detail]
    if isinstance(detail.get('input'), dict):
        candidates.append(detail['input'])
    candidates.extend(detail.get('samples', []))
    for sample in candidates:
        scene = sample.get('scene')
        if scene:
            if abs(scene['radius'] - 6) > 1e-6 or any(abs(v) > 1e-6 for v in scene['target']):
                violations.append({'event': kind, 'reason': 'radius or target changed'})
            if scene['cubeMatrix'] != identity:
                violations.append({'event': kind, 'reason': 'cube transform changed'})
            if not .1 - 1e-8 <= scene['phi'] <= math.pi - .1 + 1e-8:
                violations.append({'event': kind, 'reason': 'polar limit exceeded'})
    if 'action' in detail:
        # Batched samples already include the terminal down/up/cancel event.
        samples.extend(detail.get('samples') or [{'time': event['time'], **detail}])
    if kind == 'suspend':
        last_suspend = event
        state = detail.get('input', {})
        if detail.get('scheduledCallbacks') != 0 or state.get('primary') is not None or state.get('trackedTouches') != 0 or state.get('nativeIdentities') != 0:
            violations.append({'event': kind, 'reason': 'background input or callback residue'})
    if kind == 'resume' and last_suspend:
        state = detail.get('input', {})
        active_interval = []
        for following_event in events[event_index + 1:]:
            if following_event['event'] in ['suspend', 'disposed', 'error']:
                break
            active_interval.append(following_event)
        following = next((e for e in active_interval if e['event'] == 'present'), None)
        resumes.append({
            'backgroundMs': event['time'] - last_suspend['time'],
            'resumeCount': detail.get('count'),
            'clearInput': state.get('primary') is None and state.get('trackedTouches') == 0 and state.get('nativeIdentities') == 0,
            'listeners': state.get('listenerCount'), 'nativeObservers': state.get('nativeObserverCount'),
            'nativeRecognizers': state.get('nativeRecognizerCount'),
            'scheduledCallbacks': detail.get('scheduledCallbacks'),
            'framesUnchangedWhileSuspended': detail.get('frames') == last_suspend['detail']['frames'],
            'presentedAgain': bool(following and following['detail']['frames'] > last_suspend['detail']['frames']),
            'draggedAgain': any(s.get('action') == 'move' and s.get('input', {}).get('primary') is not None
                                for e in active_interval for s in e['detail'].get('samples', [])),
        })
        resumed = resumes[-1]
        if not (resumed['clearInput'] and resumed['listeners'] == 6 and resumed['nativeObservers'] == 1
                and resumed['scheduledCallbacks'] == 1 and resumed['framesUnchangedWhileSuspended']):
            violations.append({'event': kind, 'time': event['time'], 'reason': 'resume state or loop invariant failed'})
        last_suspend = None

samples.sort(key=lambda sample: sample['time'])
idle_scene = None
held_secondary_moves = 0
for sample in samples:
    state, scene = sample.get('input', {}), sample.get('scene')
    if sample.get('action') == 'down' and state.get('primary') is not None:
        idle_scene = None
    if idle_scene and scene and any(scene[k] != idle_scene[k] for k in ['theta', 'phi']):
        violations.append({'event': 'touch', 'time': sample['time'], 'reason': 'camera changed without new primary down'})
    if state.get('primary') is None:
        if sample.get('action') == 'move' and state.get('trackedTouches', 0) > 0:
            held_secondary_moves += 1
        if scene:
            idle_scene = scene

moves = [s for s in samples if s.get('action') == 'move']
multi = any(s.get('input', {}).get('trackedTouches', 0) >= 2 for s in samples)
primary_release_with_other_held = any(s.get('action') in ['up', 'cancel'] and s.get('input', {}).get('primary') is None and s.get('input', {}).get('trackedTouches', 0) > 0 for s in samples)
cancel = any(s.get('action') == 'cancel' for s in samples)
successful_resumes = [r for r in resumes if r['backgroundMs'] >= 5000 and r['clearInput'] and r['listeners'] == 6 and r['nativeObservers'] == 1 and r['scheduledCallbacks'] == 1 and r['framesUnchangedWhileSuspended'] and r['presentedAgain'] and r['draggedAgain']]
pending = []
if not moves: pending.append('physical horizontal/vertical/diagonal drags and release')
if not multi or not primary_release_with_other_held: pending.append('second finger and primary release while other finger stays down')
if not cancel: pending.append('physical boundary/system cancellation')
if len(successful_resumes) < 5: pending.append('five background intervals of at least five seconds with resumed presentation')
if not args.recording or not args.recording.is_file(): pending.append('physical gesture screen recording and visual review')
result = {'status': 'failed' if violations else 'pending' if pending else 'needs-visual-review',
          'violations': violations, 'pending': pending, 'touchSamples': len(samples), 'moveSamples': len(moves),
          'observedMultitouch': multi, 'observedPrimaryReleaseWithOtherHeld': primary_release_with_other_held,
          'observedNativeCancel': cancel, 'backgroundCycles': resumes,
          'heldSecondaryMoveSamples': held_secondary_moves,
          'sampledPhiRange': [min(s['scene']['phi'] for s in samples if 'scene' in s), max(s['scene']['phi'] for s in samples if 'scene' in s)] if samples else None,
          'successfulFiveSecondResumes': len(successful_resumes),
          'scope': 'Real event and invariant audit; does not certify gestures from simulated unit tests or replace visual recording review.'}
print(json.dumps(result, indent=2))
if violations: raise SystemExit(1)
