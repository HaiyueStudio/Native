"""Measure unchanged native captures; visual review remains part of A04."""
import argparse
import hashlib
import json
from pathlib import Path
from png_read import read_rgba

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
args = parser.parse_args()
captures = {}
summary = {}
background = bytes([6, 14, 24, 255])
for name in ['default', 'roughness-0.15', 'roughness-0.75']:
    file = args.directory / (name + '.png')
    width, height, pixels = read_rgba(file)
    assert (width, height) == (860, 1678), 'Acceptance drawing size changed'
    assert all(a == 255 for a in pixels[3::4]), 'Nonopaque pixels'
    mask = {i for i in range(width * height) if pixels[i*4:i*4+4] != background}
    assert mask and len(mask) < width * height * 0.8, 'Empty or unframed cube'
    xs = [i % width for i in mask]
    ys = [i // width for i in mask]
    bounds = [min(xs), min(ys), max(xs), max(ys)]
    assert bounds[0] > 0 and bounds[2] < width - 1, 'Cube touches horizontal edges'
    assert bounds[1] > 0 and bounds[3] < height - 1, 'Cube touches vertical edges'
    brightness = sorted(0.2126*pixels[i*4] + 0.7152*pixels[i*4+1] + 0.0722*pixels[i*4+2] for i in mask)
    summary[name] = {
        'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
        'width': width, 'height': height, 'opaquePixels': width * height,
        'cubePixels': len(mask), 'bounds': bounds,
        'luminance8bit': {str(q): round(brightness[min(len(brightness)-1, int(q*len(brightness)))], 3) for q in [0, .5, .95, .99, 1]},
        'whitePixels': sum(all(pixels[i*4+c] >= 250 for c in range(3)) for i in mask),
    }
    captures[name] = (pixels, mask)

smooth, mask = captures['roughness-0.15']
rough, rough_mask = captures['roughness-0.75']
assert mask == rough_mask == captures['default'][1], 'Geometry/framing changed between variants'
deltas = [max(abs(smooth[i*4+c] - rough[i*4+c]) for c in range(3)) for i in mask]
changed = sum(delta >= 8 for delta in deltas)
assert changed > len(mask) * .05, 'Roughness comparison is too weak'
print(json.dumps({'status': 'passed', 'captures': summary, 'comparison': {
    'identicalSilhouette': True, 'changedPixelsAtLeast8Levels': changed,
    'changedFraction': round(changed/len(mask), 5),
    'meanMaxChannelDifference': round(sum(deltas)/len(deltas), 3),
    'maxChannelDifference': max(deltas),
}, 'scope': 'PNG integrity, framing, opacity and material response; combine with visual review and native logs.'}, indent=2))
