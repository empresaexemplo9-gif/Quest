import fs from 'node:fs';
import path from 'node:path';
import {nativeToolkit} from './native-map.mjs';

// The same collision geometry is written to the client and native server.
export function writeNativeRegion(data, region, props, blocked, material, lighting) {
  const {bytes,i,f,s,sh,write}=nativeToolkit(data,[],fs,path);
  const N=region.width;
  const cells=[];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)cells.push(bytes(f(0,0,0,0),i(blocked(x,y)?1:0)));
  write(region.id+'.gat',bytes(Buffer.from('GRAT'),Buffer.from([1,2]),i(N,N),...cells));
  const tex=['meadow','overgrown','trail','cobble','sand','stone','water','basalt','floor'],tiles=[],surfaces=[],lights=[];
  for(let y=0;y<N/2;y++)for(let x=0;x<N/2;x++){
    const gx=x*2,gy=y*2,k=y*N/2+x,light=Buffer.alloc(256);
    const nearest=props.filter(p=>Math.abs(p.x-gx)<20&&Math.abs(p.y-gy)<20);
    for(let py=0;py<8;py++)for(let px=0;px<8;px++){
      const a=gx+px/7*2,b=gy+2-py/7*2;
      let shade=0;
      for(const p of nearest)shade=Math.max(shade,Math.exp(-(((a-p.x-1)/Math.max(2,p.w/2+2))**2+((b-p.y+1)/Math.max(2,p.d/2+2))**2))*.25);
      light[py*8+px]=Math.round(255*(1-shade));
    }
    lights.push(light);
    tiles.push(bytes(f(0,1,0,1,0,0,1,1),sh(tex.indexOf(material(gx+1,gy+1)),k),Buffer.from([255,255,255,255])));
    surfaces.push(bytes(f(0,0,0,0),i(k,-1,-1)));
  }
  write(region.id+'.gnd',bytes(Buffer.from('GRGN'),Buffer.from([1,7]),i(N/2,N/2),f(10),i(tex.length,80),...tex.map(t=>s('eridan/'+t+'.bmp',80)),i(lights.length,8,8,1),...lights,i(tiles.length),...tiles,...surfaces));
  const objects=props.map(p=>bytes(i(1),s(p.label,40),i(0),f(1),i(0),s('eridan/'+p.model+'.rsm',80),s('',80),f((p.x-N/2)*5,0,(p.y-N/2)*5),f(0,p.rotation,0),f(p.scale,p.scale,p.scale)));
  const quad=bytes(...Array.from({length:1365},()=>f(N*2.5,0,N*2.5,-N*2.5,-180,-N*2.5,N*2.5,150,N*2.5,0,-50,0)));
  write(region.id+'.rsw',bytes(Buffer.from('GRSW'),Buffer.from([2,1]),s('',40),s(region.id+'.gnd',40),s(region.id+'.gat',40),s('',40),f(10000),i(0),f(0,0,0),i(3),i(40,52),f(...lighting),i(-N*5,N*5,-N*5,N*5),i(objects.length),...objects,quad));
}
