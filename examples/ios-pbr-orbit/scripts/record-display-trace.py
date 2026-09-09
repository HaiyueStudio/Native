"""Record a minimal real-display trace, then export only after recording succeeds.

This is acquisition, not an acceptance verdict. Inspect TOC, actual time coverage,
process attribution, and a separately collected gesture journal before analysis.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', required=True, help='Paired device identifier accepted by xctrace')
    parser.add_argument('--output', required=True, type=Path, help='New run directory; never overwrites an existing capture')
    parser.add_argument('--process', default='iospbrorbit')
    parser.add_argument('--seconds', type=int, default=75)
    args = parser.parse_args()
    if args.seconds < 70:
        parser.error('Use at least 70 seconds to allow the required warmup and sample window')
    args.output.mkdir(parents=True, exist_ok=False)
    env = dict(os.environ, DEVELOPER_DIR=os.environ.get('DEVELOPER_DIR', '/Applications/Xcode.app/Contents/Developer'))
    # The export compatibility workaround is deliberately not applied to record.
    env.pop('MallocNanoZone', None)
    env.pop('LIBDISPATCH_COOPERATIVE_POOL_STRICT', None)
    template = Path(env['DEVELOPER_DIR']).parent / 'Applications/Instruments.app/Contents/Packages/Base.instrdst/Contents/Templates/Blank.tracetemplate'
    if not template.is_file():
        parser.error('Installed Xcode Blank template is missing: ' + str(template))
    trace = args.output / 'display.trace'
    state = {'status': 'recording', 'requestedSeconds': args.seconds,
             'instruments': ['Display', 'Thermal State'], 'process': args.process,
             'acceptance': 'unproven', 'startedEpochSeconds': time.time()}
    def save():
        (args.output / 'acquisition.json').write_text(json.dumps(state, indent=2) + '\n')
    save()
    command = ['xcrun', 'xctrace', 'record', '--template', str(template), '--instrument', 'Display',
               '--instrument', 'Thermal State', '--device', args.device, '--attach', args.process,
               '--time-limit', str(args.seconds) + 's', '--output', str(trace)]
    with (args.output / 'record.log').open('w') as log:
        result = subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT)
    state['recordExitCode'] = result.returncode
    if result.returncode:
        state['status'] = 'record-failed'
        save()
        raise SystemExit(result.returncode)
    state['status'] = 'exporting'
    save()
    export_env = dict(env, MallocNanoZone='0', LIBDISPATCH_COOPERATIVE_POOL_STRICT='1')
    exports = [('toc', ['--toc']),
               ('surfaces', ['--xpath', '/trace-toc/run[@number="1"]/data/table[@schema="displayed-surfaces-interval"]']),
               ('thermal', ['--xpath', '/trace-toc/run[@number="1"]/data/table[@schema="device-thermal-state-intervals"]'])]
    for name, flags in exports:
        with (args.output / ('export-' + name + '.log')).open('w') as log:
            result = subprocess.run(['xcrun', 'xctrace', 'export', '--input', str(trace), *flags,
                                     '--output', str(args.output / (name + '.xml'))],
                                    env=export_env, stdout=log, stderr=subprocess.STDOUT)
        state[name + 'ExportExitCode'] = result.returncode
        save()
        if result.returncode:
            state['status'] = 'export-failed'
            save()
            raise SystemExit(result.returncode)
    state['status'] = 'exported-awaiting-coverage-and-gesture-review'
    state['finishedEpochSeconds'] = time.time()
    save()
    print(json.dumps(state, indent=2))


if __name__ == '__main__':
    main()
