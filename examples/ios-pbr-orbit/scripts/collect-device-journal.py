"""Export the app's bounded journal while a physical acceptance run is in progress."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--device', required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--seconds', type=float, default=240)
parser.add_argument('--new-launches', type=int, default=0)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, DEVELOPER_DIR=os.environ.get('DEVELOPER_DIR', '/Applications/Xcode.app/Contents/Developer'))
snapshot = args.output / 'latest.jsonl'
sessions, baseline = {}, None
started = time.monotonic()
while time.monotonic() - started < args.seconds:
    try:
        result = subprocess.run(['xcrun', 'devicectl', '--timeout', '20', 'device', 'copy', 'from', '--device', args.device,
                             '--domain-type', 'appDataContainer', '--domain-identifier', 'org.haiyue.native.iospbrorbit',
                             '--source', 'Documents/g04-host.jsonl', '--destination', str(snapshot)],
                                env=env, capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        (args.output / 'last-copy-error.log').write_text('CoreDevice copy timed out; previously captured sessions retained.\n')
        time.sleep(1)
        continue
    if result.returncode == 0:
        events = [json.loads(line) for line in snapshot.read_text().splitlines() if line.strip()]
        header = next((e for e in events if e['event'] == 'host-created'), None)
        if header:
            session = str(header['time'])
            if baseline is None:
                baseline = session
                print('Baseline captured; awaiting physical launches.', flush=True)
            if session not in sessions:
                sessions[session] = {}
                print('Observed host session', session, flush=True)
            for event in events:
                sessions[session][json.dumps(event, sort_keys=True)] = event
            ordered = sorted(sessions[session].values(), key=lambda e: e['time'])
            (args.output / f'session-{session}.jsonl').write_text(''.join(json.dumps(e, separators=(',', ':')) + '\n' for e in ordered))
            completed = [key for key, records in sessions.items() if key != baseline and any(
                e['event'] == 'present' and e['detail']['frames'] >= 240 for e in records.values())]
            if args.new_launches and len(completed) >= args.new_launches:
                print('Captured', len(completed), 'new launches with at least 240 presented frames.', flush=True)
                break
    else:
        (args.output / 'last-copy-error.log').write_text(result.stderr + result.stdout)
    time.sleep(1)
(args.output / 'collection.json').write_text(json.dumps({'baselineSession': baseline, 'sessions': list(sessions),
    'elapsedSeconds': time.monotonic() - started, 'requestedNewLaunches': args.new_launches}, indent=2) + '\n')
