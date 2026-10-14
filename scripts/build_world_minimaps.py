"""Draw native minimaps from collision grids and ground material IDs."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import struct
root = Path(__file__).resolve().parents[1]
data = root / 'content/eridan/data'
city = json.loads((data.parent/'city.json').read_text(encoding='utf-8'))
world = json.loads((data.parent/'world.json').read_text(encoding='utf-8'))
colors={'grass':(68,104,61),'meadow':(77,115,64),'overgrown':(56,88,56),'dirt':(142,125,91),
        'trail':(154,135,96),'cobble':(155,150,132),'concrete':(152,153,139),'sand':(185,149,92),
        'stone':(95,99,91),'water':(36,116,146),'basalt':(45,46,51),'floor':(118,125,137)}
interface=''.join(chr(c) for c in [0xc0,0xaf,0xc0,0xfa,0xc0,0xce,0xc5,0xcd,0xc6,0xe4,0xc0,0xcc,0xbd,0xba])
for name in [*city['maps'],*[r['id'] for r in world['regions']]]:
    gat=(data/(name+'.gat')).read_bytes();gnd=(data/(name+'.gnd')).read_bytes()
    width,height=struct.unpack_from('<II',gat,6);gw,gh=struct.unpack_from('<II',gnd,6)
    count,length=struct.unpack_from('<II',gnd,18);at=26
    textures=[gnd[at+k*length:at+(k+1)*length].split(b'\0')[0].decode('ascii').split('/')[-1].split('.')[0] for k in range(count)]
    at+=count*length
    lights,lw,lh,channels=struct.unpack_from('<IIII',gnd,at);at+=16+lights*lw*lh*(channels+3)
    tiles=struct.unpack_from('<I',gnd,at)[0];at+=4
    texture_ids=[struct.unpack_from('<H',gnd,at+k*40+32)[0] for k in range(tiles)]
    at+=tiles*40
    top_tiles=[struct.unpack_from('<i',gnd,at+k*28+16)[0] for k in range(gw*gh)]
    image=Image.new('RGB',(width,height));pixels=image.load()
    for y in range(height):
        for x in range(width):
            t=textures[texture_ids[top_tiles[x//2+(y//2)*gw]]]
            color=colors.get(t,(129,128,102))
            if struct.unpack_from('<I',gat,14+(x+y*width)*20+16)[0]==1:color=tuple(int(c*.48) for c in color)
            pixels[x,height-1-y]=color
    draw=ImageDraw.Draw(image)
    portals=[city['exit'],*city['routeGates']] if name in city['maps'] else next(r['portals'] for r in world['regions'] if r['id']==name)
    for x,y in portals:
        py=height-1-y;draw.ellipse((x-3,py-3,x+3,py+3),fill=(242,211,120),outline=(35,37,31))
    for folder in [interface,'유저인터페이스']:
        target=root/'content/ragnarok/data/texture'/folder/'map';target.mkdir(parents=True,exist_ok=True)
        image.save(target/(name+'.bmp'))
print(f"{len(city['maps'])+len(world['regions'])} minimapas nativos com caminhos, bloqueios, água e portais reais.")
