"""Regression checks for accepting actual display traces, including truncated captures."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/analyze-displayed-frames.py'


class DisplayedFrameAcceptance(unittest.TestCase):
    def analyze(self, first, last, step):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp)
            root = ET.Element('trace-query-result')
            table = ET.SubElement(root, 'node')
            schema = ET.SubElement(table, 'schema', name='displayed-surfaces-interval')
            for key in ['start', 'duration', 'display-name', 'surface-id', 'event-label']:
                ET.SubElement(ET.SubElement(schema, 'col'), 'mnemonic').text = key
            for i, stamp in enumerate(range(first, last, step)):
                row = ET.SubElement(table, 'row')
                ET.SubElement(row, 'start-time').text = str(stamp)
                ET.SubElement(row, 'duration').text = str(step)
                ET.SubElement(row, 'string', fmt='Main display').text = '1'
                ET.SubElement(row, 'surface-id').text = '1'
                if i == 0:
                    ET.SubElement(row, 'narrative', id='target-label', fmt='iospbrorbit (123)')
                else:
                    ET.SubElement(row, 'narrative', ref='target-label')
            row = ET.SubElement(table, 'row')
            ET.SubElement(row, 'start-time').text = str(20_000_000_000)
            ET.SubElement(row, 'duration').text = '1'
            ET.SubElement(row, 'string', fmt='Main display')
            ET.SubElement(row, 'surface-id').text = '2'
            ET.SubElement(row, 'narrative', fmt='OtherApp (234)')
            ET.ElementTree(root).write(p / 'surfaces.xml')
            (p / 'toc.xml').write_text('<trace-toc><run><info><summary><start-date>1970-01-01T00:00:00+00:00</start-date></summary></info></run></trace-toc>')
            events = [{'time': 10000, 'event': 'touch', 'detail': {'input': {'primary': 1}}}]
            events += [{'time': t, 'event': 'present', 'detail': {'input': {'primary': 1, 'trackedTouches': 1, 'scene': {'theta': t, 'phi': 1}}}} for t in range(10000, 70001, 1000)]
            events.append({'time': 70000, 'event': 'touch', 'detail': {'input': {'primary': None}}})
            (p / 'journal.jsonl').write_text('\n'.join(json.dumps(e) for e in events))
            run = subprocess.run([sys.executable, str(SCRIPT), str(p / 'surfaces.xml'), '--toc', str(p / 'toc.xml'), '--journal', str(p / 'journal.jsonl'), '--output', str(p / 'out')], capture_output=True, text=True)
            return run.returncode, json.loads((p / 'out/performance-summary.json').read_text())

    def test_truncated_trace_is_pending_without_false_low_fps(self):
        code, result = self.analyze(67_000_000_000, 91_000_000_000, 16_666_667)
        self.assertEqual(code, 0)
        self.assertEqual(result['status'], 'pending')
        self.assertIsNone(result['effectiveDisplayedFps'])
        self.assertEqual(result['failures'], [])

    def test_full_sixty_hz_trace_resolves_refs_and_ignores_other_app(self):
        code, result = self.analyze(0, 75_000_000_000, 16_666_667)
        self.assertEqual(code, 0)
        self.assertEqual(result['status'], 'passed')
        self.assertAlmostEqual(result['effectiveDisplayedFps'], 60, delta=.02)
        self.assertEqual(result['displayedFrames'], 3600)

    def test_full_twenty_hz_trace_fails_fixed_threshold(self):
        code, result = self.analyze(0, 75_000_000_000, 50_000_000)
        self.assertEqual(code, 1)
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['effectiveDisplayedFps'], 20)


if __name__ == '__main__':
    unittest.main()
