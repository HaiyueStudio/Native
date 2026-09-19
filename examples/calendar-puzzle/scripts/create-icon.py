"""Deterministic calendar/pentomino app icon; requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1] / 'App_Resources/iOS'
image = Image.new('RGB', (1024, 1024), '#eef6f1')
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((114,154,910,898),radius=80,fill='#c9904f')
draw.rounded_rectangle((136,174,888,872),radius=62,fill='#fff4d5')
draw.rounded_rectangle((136,174,888,340),radius=62,fill='#0e877f')
draw.rectangle((136,260,888,340),fill='#0e877f')
for x in [304,720]:
 draw.rounded_rectangle((x-24,100,x+24,228),radius=24,fill='#26323a')
pattern=['rrryy','ggryy','ggbpp','cbbpp','ccc.p']
colors={'r':'#ef6f6c','y':'#f4c95d','g':'#70c1b3','b':'#4d96d7','p':'#b86adf','c':'#8bc34a','.':'#eef6f1'}
for y,row in enumerate(pattern):
 for x,c in enumerate(row):
  px=222+x*118;py=370+y*94
  draw.rounded_rectangle((px,py,px+104,py+80),radius=14,fill=colors[c])
for size,name in [(180,'AppIcon60x60@3x'),(120,'AppIcon60x60@2x'),(120,'AppIcon40x40@3x'),(80,'AppIcon40x40@2x'),(87,'AppIcon29x29@3x'),(58,'AppIcon29x29@2x'),(1024,'AppIcon1024')]:
 image.resize((size,size),Image.Resampling.LANCZOS).save(root/(name+'.png'))
