"""Generate original seamless terrain materials, without altering reference artwork."""
from pathlib import Path
from PIL import Image
import math

root = Path(__file__).resolve().parents[1] / 'content/eridan/data/texture/eridan'
root.mkdir(parents=True, exist_ok=True)
size = 256
palettes = {'sand': (185, 149, 92), 'stone': (90, 94, 86),
            'water': (29, 94, 116), 'basalt': (47, 49, 55), 'floor': (73, 79, 82)}
def color(name, x, y):
    u, v = x / size * math.tau, y / size * math.tau
    grain = math.sin(u*37+v*19)*math.cos(v*43-u*13)
    field = math.sin(u*3+math.sin(v*2))*math.cos(v*4-u)
    if name == 'sand': amount = 9*math.sin(v*8+math.sin(u*2)*2)+field*8+grain*5
    elif name == 'water': amount = 9*math.sin(v*12+math.sin(u*3))+6*math.sin(u*15+v*8)+grain*2
    elif name == 'floor':
        joint = x % 64 < 3 or y % 64 < 3
        amount = -23 if joint else grain*6+field*9
    else: amount = field*20+grain*10+math.sin(u*21+v*9)*3
    return tuple(max(0, min(255, int(c+amount))) for c in palettes[name])
for name in palettes:
    image = Image.new('RGB', (size, size))
    image.putdata([color(name,x,y) for y in range(size) for x in range(size)])
    image.save(root / (name+'.bmp'))
print('Cinco materiais originais de areia, rocha, oceano e subsolo preparados.')
