from pathlib import Path
from PIL import Image
from io import BytesIO
import json,struct,hashlib,shutil
root=Path(__file__).resolve().parents[4]
source=root/'Games/games/neon-circuit/assets'; out=root/'Native/examples/neon-circuit/src/game-assets';out.mkdir(parents=True,exist_ok=True)
manifest={}
for src in source.glob('*.png'):
 image=Image.open(src).convert('RGBA')
 if src.stem not in ['sunny-panorama','space-panorama','planet-azure','planet-amber','planet-violet','meteor-streak']:image=image.resize((512,512),Image.Resampling.LANCZOS)
 # Bundle tightly packed, straight-alpha pixels; no runtime browser decoder.
 data=image.tobytes();(out/(src.stem+'.rgba')).write_bytes(data)
 manifest[src.stem]={'width':image.width,'height':image.height,'file':src.stem+'.rgba','sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sha256':hashlib.sha256(data).hexdigest()}
(out/'textures.json').write_text(json.dumps(manifest,indent=2))
glb=(source/'wraith-raider.glb').read_bytes();offset=12;gltf=None;binary=None
while offset<len(glb):
 size,kind=struct.unpack_from('<II',glb,offset);chunk=glb[offset+8:offset+8+size];offset+=size+8
 if kind==0x4e4f534a:gltf=json.loads(chunk)
 if kind==0x004e4942:binary=chunk
model=out/'wraith-raider';model.mkdir(exist_ok=True); entries=[]
for i,entry in enumerate(gltf.get('images',[])):
 view=gltf['bufferViews'][entry['bufferView']];start=view.get('byteOffset',0)
 img=Image.open(BytesIO(binary[start:start+view['byteLength']])).convert('RGBA');data=img.tobytes()
 name=f'texture-{i}.png';rgba=f'texture-{i}.rgba';(model/rgba).write_bytes(data)
 entries.append({'image':name,'rgba':rgba,'width':img.width,'height':img.height})
 entry.pop('bufferView',None);entry.pop('mimeType',None);entry['uri']=name
(model/'textures.json').write_text(json.dumps(entries,indent=2));(model/'model.gltf').write_text(json.dumps(gltf));(model/'model.bin').write_bytes(binary)
(out/'source.json').write_text(json.dumps({'modelSha256':hashlib.sha256(glb).hexdigest(),'modelBytes':len(glb),'textures':manifest},indent=2))
print('Prepared',len(manifest),'images and',len(entries),'PBR model textures')

audio=out/'audio';audio.mkdir(exist_ok=True)
for wav in (source/'audio').glob('*.wav'):shutil.copy2(wav,audio/wav.name)
