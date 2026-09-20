"""Shared Sudoku/LED geometry -> opaque iOS PNGs, SVG and Android vector.
No fonts, external assets or graphics dependencies. Supersampled for small icons.
"""
from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent / 'App_Resources'
SHAPES = []

def polygon(points, color):
    SHAPES.append((points, color))

def rect(x, y, width, height, color, radius=0):
    points = []
    if radius:
        for cx, cy, start in [(x+width-radius,y+radius,-90),(x+width-radius,y+height-radius,0),(x+radius,y+height-radius,90),(x+radius,y+radius,180)]:
            for n in range(9):
                angle = math.radians(start+n*90/8)
                points.append((cx+radius*math.cos(angle),cy+radius*math.sin(angle)))
    else:
        points = [(x,y),(x+width,y),(x+width,y+height),(x,y+height)]
    polygon(points, color)

def digit(cx, cy, mask, on, off):
    def horizontal(y):
        return [(-41,y),(-29,y-11),(29,y-11),(41,y),(29,y+11),(-29,y+11)]
    def vertical(x,y):
        return [(x,y),(x+11,y+11),(x+11,y+54),(x,y+65),(x-11,y+54),(x-11,y+11)]
    segments = [horizontal(-77),vertical(45,-72),vertical(45,7),horizontal(77),vertical(-45,7),vertical(-45,-72),horizontal(0)]
    for bit, points in enumerate(segments):
        polygon([(cx+x,cy+y) for x,y in points], on if mask & (1 << bit) else off)

# A visible Sudoku block is the silhouette; gold partial segments convey LED play.
rect(0,0,1024,1024,'#061015')
rect(128,128,768,768,'#4c727b',58)
rect(142,142,740,740,'#10252d',46)
rect(392,392,240,240,'#30291e',16)
rect(648,648,234,234,'#83ffc1',34)
for at in [378,634]:
    rect(at,142,12,740,'#4c727b')
    rect(142,at,740,12,'#4c727b')
# Two empty cells, six complete digits, one partial LED clue.
for row, masks in enumerate([[0x06,0x5b,0], [0x66,0x60,0x7d], [0,0x7f,0x6f]]):
    for col, mask in enumerate(masks):
        selected = row == 2 and col == 2
        clue = row == 1 and col == 1
        digit(256+col*256,256+row*256,mask,
              '#102a2d' if selected else '#f4c677' if clue else '#adede7',
              '#69dca5' if selected else '#483a25' if clue else '#19333c')

def png(size):
    scale = 2 if size >= 1024 else 4
    side = size * scale
    pixels = bytearray(side*side*3)
    for points, color in SHAPES:
        rgb = bytes.fromhex(color[1:])
        poly = [(x*side/1024,y*side/1024) for x,y in points]
        edges = list(zip(poly,poly[1:]+poly[:1]))
        for y in range(max(0,math.floor(min(p[1] for p in poly))),min(side,math.ceil(max(p[1] for p in poly)))):
            yy = y+.5
            cuts = sorted(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]) for a,b in edges if (a[1]<=yy<b[1]) or (b[1]<=yy<a[1]))
            for left,right in zip(cuts[::2],cuts[1::2]):
                x0=max(0,math.ceil(left-.5)); x1=min(side,math.ceil(right-.5))
                if x1>x0:
                    at=(y*side+x0)*3
                    pixels[at:at+(x1-x0)*3]=rgb*(x1-x0)
    output = bytearray(size*size*3)
    count=scale*scale
    for y in range(size):
        for x in range(size):
            at=(y*size+x)*3
            for c in range(3):
                output[at+c]=round(sum(pixels[((y*scale+dy)*side+x*scale+dx)*3+c] for dy in range(scale) for dx in range(scale))/count)
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    rows=b''.join(b'\0'+output[y*size*3:(y+1)*size*3] for y in range(size))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b'')

if __name__ == '__main__':
    for name,size in [('AppIcon29x29@2x',58),('AppIcon29x29@3x',87),('AppIcon40x40@2x',80),('AppIcon40x40@3x',120),('AppIcon60x60@2x',120),('AppIcon60x60@3x',180),('AppIcon1024',1024)]:
        (ROOT/'iOS'/(name+'.png')).write_bytes(png(size))
    paths = [('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in points)+'Z',color) for points,color in SHAPES]
    brand = ROOT/'branding'
    brand.mkdir(exist_ok=True)
    (brand/'icon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n'+'\n'.join(f'<path fill="{color}" d="{d}"/>' for d,color in paths)+'\n</svg>\n')
    (ROOT/'Android/src/main/res/drawable/icon.xml').write_text('<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="1024" android:viewportHeight="1024">\n'+'\n'.join(f'  <path android:fillColor="{color}" android:pathData="{d}" />' for d,color in paths)+'\n</vector>\n')
    print('Generated Sudoku/LED icon: 7 iOS PNGs, Android vector, SVG master.')
