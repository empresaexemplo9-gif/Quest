"""Split the original generated material atlas into native BMP textures and terrain transitions."""
from pathlib import Path
from PIL import Image
import math

root = Path(__file__).resolve().parents[1]
source = root / 'content/eridan/sources/materiais-vila-v2.png'
destination = root / 'content/eridan/data/texture/eridan'
destination.mkdir(parents=True, exist_ok=True)
atlas = Image.open(source).convert('RGB')
names = ['grass','cobble','concrete','plaster','metal','glass','moss','bark',
         'leaves','rust','dirt','rubble','energy','wood','roof','canvas']
textures = {}
for index, name in enumerate(names):
    column, row = index % 4, index // 4
    bounds = (round(column*atlas.width/4)+2, round(row*atlas.height/4)+2,
              round((column+1)*atlas.width/4)-2, round((row+1)*atlas.height/4)-2)
    image = atlas.crop(bounds).resize((256,256), Image.Resampling.LANCZOS)
    image.save(destination / (name+'.bmp'))
    textures[name] = image

# Sixteen marching-square masks join paving to grass, without a hard square border.
grass, paving = textures['grass'], textures['cobble']
for bits in range(1,15):
    mask = Image.new('L',(256,256))
    pixels = mask.load()
    a,b,c,d = [(bits >> k) & 1 for k in range(4)]
    for y in range(256):
        v = y/255
        for x in range(256):
            u = x/255
            coverage = a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v
            variation = .045*math.sin(x*.071+math.sin(y*.038)*3)
            fade = max(0,min(1,(coverage+variation-.32)/.36))
            pixels[x,y] = round(fade*255)
    Image.composite(paving,grass,mask).save(destination / f'road_{bits:02d}.bmp')

for name, left, right, amount in [('meadow','grass','dirt',.12),
                                  ('trail','dirt','grass',.28),
                                  ('overgrown','grass','moss',.38)]:
    Image.blend(textures[left], textures[right], amount).save(destination/(name+'.bmp'))
print(f'{len(names)+14+3} native 256px BMP materials prepared from the original atlas.')
