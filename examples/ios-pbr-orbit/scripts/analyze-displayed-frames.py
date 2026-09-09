"""Analyze Instruments displayed-surfaces-interval, never JS callback timestamps."""
import argparse
import csv
from datetime import datetime
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET


def percentile(values, fraction):
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)]


def displayed_frames(path, process):
    root = ET.parse(path).getroot()
    ids = {node.get('id'): node for node in root.iter() if node.get('id')}
    def resolve(node):
        return ids[node.get('ref')] if node.get('ref') else node
    frames = []
    for table in root.findall('node'):
        schema = table.find('schema')
        if schema is None or schema.get('name') != 'displayed-surfaces-interval':
            continue
        columns = [col.findtext('mnemonic') for col in schema.findall('col')]
        for row in table.findall('row'):
            values = dict(zip(columns, [resolve(col) for col in row]))
            label = values['event-label'].get('fmt', '')
            if process + ' (' not in label:
                continue
            frames.append({'swapNs': int(values['start'].text),
                           'durationNs': int(values['duration'].text),
                           'display': values['display-name'].get('fmt'),
                           'surfaceId': values['surface-id'].text,
                           'label': label})
    return sorted(frames, key=lambda frame: frame['swapNs'])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('surfaces', type=Path)
    parser.add_argument('--toc', type=Path, required=True)
    parser.add_argument('--journal', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--start', type=float, default=10)
    parser.add_argument('--seconds', type=float, default=60)
    parser.add_argument('--process', default='iospbrorbit')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    frames = displayed_frames(args.surfaces, args.process)
    if len(frames) < 2:
        raise ValueError('No target-process displayed surface series')
    toc = ET.parse(args.toc).getroot()
    trace_start = datetime.fromisoformat(toc.findtext('./run/info/summary/start-date')).timestamp() * 1000
    start, end = int(args.start * 1e9), int((args.start + args.seconds) * 1e9)
    selected = [frame for frame in frames if start <= frame['swapNs'] < end]
    unique = sorted({frame['swapNs'] for frame in selected})
    if len(unique) < 2:
        raise ValueError('Insufficient frames in requested measurement window')
    intervals = [(b - a) / 1e6 for a, b in zip(unique, unique[1:])]
    pending, failures = [], []
    if args.start < 10 or args.seconds < 60:
        pending.append('Required 10-second warmup and 60-second measurement window')
    complete_window = frames[0]['swapNs'] <= start and frames[-1]['swapNs'] >= end - 50_000_000
    if not complete_window:
        pending.append('Trace does not cover the full requested window')
    if len({frame['display'] for frame in selected}) != 1 or len(unique) != len(selected):
        pending.append('Ambiguous multiple-display or duplicate-swap series')
    fps = len(unique) / args.seconds if complete_window else None
    p95 = percentile(intervals, .95)
    if complete_window and (fps < 30 or p95 > 50):
        failures.append('Actual displayed-frame cadence below fixed acceptance threshold')

    events = [json.loads(line) for line in args.journal.read_text().splitlines() if line.strip()]
    wall_start, wall_end = trace_start + start / 1e6, trace_start + end / 1e6
    interruptions = [e for e in events if wall_start <= e['time'] <= wall_end
                     and e['event'] in ['suspend', 'disposed', 'error', 'device-lost']]
    if interruptions:
        failures.append('App interrupted or failed during measurement window')
    held, longest_held, motion_pairs, motion_seconds = None, 0, 0, 0
    snapshots = []
    for event in events:
        detail = event['detail'] or {}
        state = detail.get('input', {})
        if event['event'] == 'touch':
            if state.get('primary') is not None and held is None:
                held = event['time']
            if state.get('primary') is None and held is not None:
                longest_held = max(longest_held, max(0, min(event['time'], wall_end) - max(held, wall_start)) / 1000)
                held = None
        if event['event'] == 'present' and wall_start <= event['time'] <= wall_end:
            snapshots.append((event['time'], state))
    if held is not None:
        longest_held = max(longest_held, max(0, min(events[-1]['time'], wall_end) - max(held, wall_start)) / 1000)
    for (time_a, a), (time_b, b) in zip(snapshots, snapshots[1:]):
        seconds = (time_b - time_a) / 1000
        if a.get('primary') is not None and a.get('primary') == b.get('primary') and a.get('trackedTouches') == b.get('trackedTouches') == 1 and seconds <= 3:
            if any(a['scene'][key] != b['scene'][key] for key in ['theta', 'phi']):
                motion_pairs += 1
                motion_seconds += seconds
    if longest_held < 20 or motion_seconds < 20:
        pending.append('At least 20 seconds of held single-finger motion not established by journal samples')
    result = {'status': 'failed' if failures else 'pending' if pending else 'passed',
              'metric': 'Actual Instruments displayed surface swap timestamps for target process, not JS callbacks or GPU execution duration',
              'process': args.process, 'windowStartSeconds': args.start, 'windowDurationSeconds': args.seconds,
              'wallStartEpochMs': wall_start, 'wallEndEpochMs': wall_end, 'warmupSeconds': args.start,
              'completeWindow': complete_window, 'availableTargetFramesSeconds': [frames[0]['swapNs'] / 1e9, frames[-1]['swapNs'] / 1e9],
              'displayedFrames': len(unique), 'intervalSamples': len(intervals), 'effectiveDisplayedFps': fps,
              'intervalMs': {'mean': sum(intervals) / len(intervals), 'p50': percentile(intervals, .5), 'p95': p95, 'max': max(intervals)},
              'percentileMethod': 'nearest rank', 'longestHeldGestureSecondsInWindow': longest_held,
              'movingSingleFingerSamplePairs': motion_pairs, 'movingSingleFingerSampleSpanSeconds': motion_seconds,
              'gestureEvidenceLimit': 'Camera snapshots are periodic, not a full-rate finger trajectory; device-owner procedure confirmation is retained separately.',
              'pending': pending, 'failures': failures}
    with (args.output / 'displayed-frames.csv').open('w') as file:
        writer = csv.DictWriter(file, fieldnames=list(selected[0]))
        writer.writeheader()
        writer.writerows(selected)
    (args.output / 'performance-summary.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
