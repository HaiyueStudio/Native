"""Reproducible geometric icon. Requires Pillow; no game runtime assets."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1] / 'App_Resources/iOS'
image = Image.new('RGB', (1024, 1024), '#091321')
draw = ImageDraw.Draw(image)
faces = [((512, 164), (174, 348), (850, 348), '#e0efff'),
         ((174, 348), (174, 722), (512, 532), '#0cab70'),
         ((512, 532), (512, 906), (850, 348), '#f3433b')]
for (x, y), (ux, uy), (vx, vy), color in faces:
    def point(a, b): return (x + (ux-x)*a + (vx-x)*b, y + (uy-y)*a + (vy-y)*b)
    for i in range(3):
        for j in range(3):
            a, b, c, d = i/3+.012, j/3+.012, (i+1)/3-.012, (j+1)/3-.012
            draw.polygon([point(a,b),point(c,b),point(c,d),point(a,d)], fill=color)
for size, name in [(180,'AppIcon60x60@3x'),(120,'AppIcon60x60@2x'),(120,'AppIcon40x40@3x'),(80,'AppIcon40x40@2x'),(87,'AppIcon29x29@3x'),(58,'AppIcon29x29@2x'),(1024,'AppIcon1024')]:
    image.resize((size,size),Image.Resampling.LANCZOS).save(root / (name+'.png'))
