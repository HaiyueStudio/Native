"""Reproducible training-range icon; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1] / 'App_Resources/iOS'
image = Image.new('RGB', (1024,1024), '#15262c')
d = ImageDraw.Draw(image)
d.rounded_rectangle((65,65,959,959),radius=180,outline='#b6c3b2',width=16)
for r in [270,180,82]: d.ellipse((512-r,512-r,512+r,512+r),outline='#e3b969',width=22)
for x1,y1,x2,y2 in [(512,175,512,315),(512,709,512,849),(175,512,315,512),(709,512,849,512)]: d.line((x1,y1,x2,y2),fill='#e3b969',width=28)
d.ellipse((490,490,534,534),fill='#f2e3bd')
for size,name in [(180,'AppIcon60x60@3x'),(120,'AppIcon60x60@2x'),(120,'AppIcon40x40@3x'),(80,'AppIcon40x40@2x'),(87,'AppIcon29x29@3x'),(58,'AppIcon29x29@2x'),(1024,'AppIcon1024')]:
 image.resize((size,size),Image.Resampling.LANCZOS).save(root/(name+'.png'))
