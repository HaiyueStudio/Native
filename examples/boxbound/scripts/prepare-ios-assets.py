"""Adapt existing Boxbound icon geometry and PCM assets for the iOS package."""
from pathlib import Path
import wave, struct, zlib, math
APP=Path(__file__).resolve().parent.parent
AUDIO=APP/'artifacts/ios-audio';AUDIO.mkdir(parents=True,exist_ok=True)
for src in (APP/'../../../Games/games/boxbound/assets/audio').resolve().glob('*.wav'):
    with wave.open(str(src)) as source:
        assert source.getnchannels()==1 and source.getsampwidth()==2 and source.getframerate()==22050
        raw=source.readframes(source.getnframes());values=struct.unpack('<'+'h'*(len(raw)//2),raw)
    samples=[]
    for i,v in enumerate(values):samples.extend((v,round((v+values[min(i+1,len(values)-1)])/2)))
    with wave.open(str(AUDIO/src.name),'wb') as output:
        output.setnchannels(1);output.setsampwidth(2);output.setframerate(44100);output.writeframes(struct.pack('<'+'h'*len(samples),*samples))
# Same polygons and colours as Android's existing drawable/icon.xml.
SHAPES=[([(0,0),(108,0),(108,108),(0,108)],'#eaf0df'), ([(14,26),(54,8),(94,26),(94,80),(54,101),(14,80)],'#648da0'), ([(22,30),(54,16),(86,30),(54,46)],'#b2d1d5'), ([(30,40),(54,29),(78,40),(78,72),(54,85),(30,72)],'#ecbc79'), ([(30,40),(54,29),(78,40),(54,53)],'#fff2cf'), ([(40,59),(44,59),(44,65),(40,65)],'#34534d'), ([(64,59),(68,59),(68,65),(64,65)],'#34534d'), ([(46,71),(62,71),(62,74),(46,74)],'#34534d')]
def png(size):
    side=size*2;pixels=bytearray(side*side*3)
    for points,color in SHAPES:
        rgb=bytes.fromhex(color[1:]);poly=[(x*side/108,y*side/108) for x,y in points];edges=list(zip(poly,poly[1:]+poly[:1]))
        for y in range(max(0,math.floor(min(p[1] for p in poly))),min(side,math.ceil(max(p[1] for p in poly)))):
            yy=y+.5;cuts=sorted(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]) for a,b in edges if a[1]<=yy<b[1] or b[1]<=yy<a[1])
            for left,right in zip(cuts[::2],cuts[1::2]):
                x0=max(0,math.ceil(left-.5));x1=min(side,math.ceil(right-.5));at=(y*side+x0)*3
                if x1>x0:pixels[at:at+(x1-x0)*3]=rgb*(x1-x0)
    rows=bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            for c in range(3):rows.append(round(sum(pixels[((y*2+dy)*side+x*2+dx)*3+c] for dy in range(2) for dx in range(2))/4))
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
for name,size in [('AppIcon1024',1024),('AppIcon60x60@3x',180),('AppIcon60x60@2x',120),('AppIcon40x40@3x',120),('AppIcon40x40@2x',80),('AppIcon29x29@3x',87),('AppIcon29x29@2x',58)]:
    out=APP/'App_Resources/iOS'/f'{name}.png'
    if not out.exists():out.write_bytes(png(size))
print('Prepared iOS icon sizes and 44.1 kHz PCM sounds')
