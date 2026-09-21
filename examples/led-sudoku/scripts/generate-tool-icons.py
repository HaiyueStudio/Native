"""Deterministic 24-unit line icons rendered to transparent 96px PNGs. No dependencies."""
import math, struct, zlib
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'src'/'icons';out.mkdir(exist_ok=True)
def arc(x,y,r,a,b,n=24):return [(x+r*math.cos(a+(b-a)*i/n),y+r*math.sin(a+(b-a)*i/n)) for i in range(n+1)]
def gear():return [(12+(9 if i%4 in (1,2) else 7.2)*math.cos(i*math.pi/16),12+(9 if i%4 in (1,2) else 7.2)*math.sin(i*math.pi/16)) for i in range(33)]
icons={
 'back': [[(11,5),(4,12),(11,19)],[(4,12),(21,12)]],
 'notes': [[(4,16),(4,20),(8,20),(20,8),(16,4),(4,16)],[(13,7),(17,11)],[(4,16),(8,20)]],
 'undo': [arc(12,13,7,-math.pi*.83,math.pi*.53),[(4,5),(4,11),(10,11)]],
 'erase': [[(3,14),(12,5),(21,14),(15,20),(9,20),(3,14)],[(7,10),(16,19)],[(9,20),(22,20)]],
 'hint': [arc(12,9,6,math.pi*.25,math.pi*2.75),[(8,14),(9,18),(15,18),(16,14)],[(10,21),(14,21)]],
 'explain': [arc(12,12,9,0,math.pi*2),[(12,11),(12,17)],arc(12,7,0.5,0,math.pi*2)],
 'settings': [gear(),arc(12,12,3,0,math.pi*2)],
 'help': [arc(12,12,9,0,math.pi*2),arc(12,9,3,math.pi,math.pi*2.6),[(11,12),(11,14)],arc(11,17,0.5,0,math.pi*2)]}
def chunk(name,data):return struct.pack('!I',len(data))+name+data+struct.pack('!I',zlib.crc32(name+data)&0xffffffff)
for name,paths in icons.items():
 segments=[(a,b) for p in paths for a,b in zip(p,p[1:])];rows=[]
 for y in range(96):
  row=bytearray([0])
  for x in range(96):
   px,py=(x+.5)/4,(y+.5)/4;dist=100
   for (ax,ay),(bx,by) in segments:
    dx,dy=bx-ax,by-ay;t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy or 1)))
    dist=min(dist,math.hypot(px-ax-t*dx,py-ay-t*dy))
   row.extend((214,233,234,round(max(0,min(1,(.88-dist)*4+.5))*255)))
  rows.append(row)
 data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',96,96,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
 (out/(name+'.png')).write_bytes(data)
