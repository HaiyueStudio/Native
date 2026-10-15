"""Build native app icons from the game's original code-authored pixel tank."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
app=Path(__file__).resolve().parents[1]
assets=app.parents[1]/'games/tank-battle/assets'
meta=json.loads((assets/'atlas.json').read_text())['p1-3-0']
atlas=Image.open(assets/'atlas.png').convert('RGBA')
tank=atlas.crop((meta['x'],meta['y'],meta['x']+16,meta['y']+16))
icon=Image.new('RGB',(1024,1024),'#151b17');draw=ImageDraw.Draw(icon)
draw.rectangle((64,64,959,959),outline='#e4c477',width=16)
tank=tank.resize((640,640),Image.Resampling.NEAREST);icon.paste(tank,(192,192),tank)
android=app/'App_Resources/Android/src/main/res/drawable-nodpi'
android.mkdir(parents=True,exist_ok=True);icon.resize((192,192),Image.Resampling.NEAREST).save(android/'icon.png')
folder=app/'App_Resources/iOS/Assets.xcassets/AppIcon.appiconset';folder.mkdir(parents=True,exist_ok=True)
images=[]
for idiom,size,scales in [('iphone',20,[2,3]),('iphone',29,[2,3]),('iphone',40,[2,3]),('iphone',60,[2,3]),('ipad',20,[1,2]),('ipad',29,[1,2]),('ipad',40,[1,2]),('ipad',76,[1,2]),('ipad',83.5,[2]),('ios-marketing',1024,[1])]:
    for scale in scales:
        name=f'{idiom}-{size}-{scale}.png';pixels=round(size*scale)
        icon.resize((pixels,pixels),Image.Resampling.NEAREST).save(folder/name)
        images.append({'idiom':idiom,'size':f'{size}x{size}','scale':f'{scale}x','filename':name})
(folder/'Contents.json').write_text(json.dumps({'images':images,'info':{'version':1,'author':'xcode'}},indent=2))
