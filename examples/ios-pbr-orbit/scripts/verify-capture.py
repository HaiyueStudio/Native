"""Verify an unchanged native PNG readback against the expected clear pixels."""
import argparse
import hashlib
import json
import struct
import zlib
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('png', type=Path)
parser.add_argument('--width', type=int, required=True)
parser.add_argument('--height', type=int, required=True)
parser.add_argument('--rgba', default='6,14,24,255')
args = parser.parse_args()
expected = bytes(map(int, args.rgba.split(',')))
assert len(expected) == 4
encoded = args.png.read_bytes()
assert encoded[:8] == b'\x89PNG\r\n\x1a\n', 'Not a PNG'
position, compressed, header = 8, bytearray(), None
while position < len(encoded):
    length = struct.unpack('>I', encoded[position:position + 4])[0]
    kind = encoded[position + 4:position + 8]
    data = encoded[position + 8:position + 8 + length]
    crc = struct.unpack('>I', encoded[position + 8 + length:position + 12 + length])[0]
    assert zlib.crc32(kind + data) & 0xffffffff == crc, 'PNG chunk CRC mismatch'
    if kind == b'IHDR':
        header = struct.unpack('>IIBBBBB', data)
    if kind == b'IDAT':
        compressed.extend(data)
    position += length + 12
assert header == (args.width, args.height, 8, 6, 0, 0, 0), f'Unexpected PNG layout: {header}'
raw = zlib.decompress(compressed)
stride = args.width * 4
assert len(raw) == (stride + 1) * args.height
previous = bytearray(stride)
expected_row = expected * args.width
for y in range(args.height):
    offset = y * (stride + 1)
    mode = raw[offset]
    assert mode in range(5), f'Unknown PNG filter {mode}'
    row = bytearray(raw[offset + 1:offset + 1 + stride])
    for x in range(stride):
        left = row[x - 4] if x >= 4 else 0
        up = previous[x]
        upper_left = previous[x - 4] if x >= 4 else 0
        predictor = 0
        if mode == 1:
            predictor = left
        elif mode == 2:
            predictor = up
        elif mode == 3:
            predictor = (left + up) // 2
        elif mode == 4:
            p = left + up - upper_left
            distances = (abs(p - left), abs(p - up), abs(p - upper_left))
            predictor = (left, up, upper_left)[distances.index(min(distances))]
        row[x] = (row[x] + predictor) & 255
    if row != expected_row:
        x = next(i for i in range(0, stride, 4) if row[i:i+4] != expected)
        raise AssertionError(f'Pixel mismatch at ({x//4}, {y}): {list(row[x:x+4])}; expected {list(expected)}')
    previous = row
print(json.dumps({'status': 'passed', 'file': args.png.name, 'sha256': hashlib.sha256(encoded).hexdigest(), 'width': args.width, 'height': args.height, 'rgba': list(expected), 'checkedPixels': args.width * args.height}, indent=2))
