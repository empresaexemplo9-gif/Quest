import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
export function readGat(bytes) {
  if(bytes.subarray(0,4).toString()!=='GRAT')throw Error('Invalid city GAT');
  const width=bytes.readUInt32LE(6),height=bytes.readUInt32LE(10);
  if(!width||!height||width>512||height>512||bytes.length!==14+width*height*20)throw Error('Invalid city dimensions');
  const cells=Buffer.alloc(width*height);
  for(let k=0;k<cells.length;k++){const type=bytes.readUInt32LE(14+k*20+16);if(type>6)throw Error('Invalid GAT cell');cells[k]=type;}
  return {width,height,cells};
}
export function cacheWithMaps(base,maps) {
  if(base.length<8||base.readUInt32LE(0)!==base.length)throw Error('Invalid existing native map cache');
  const kept=[];let at=8;
  for(let k=0;k<base.readUInt16LE(4);k++) {
    if(at+20>base.length)throw Error('Truncated map cache');
    const name=base.subarray(at,at+12).toString().split('\0')[0],len=base.readInt32LE(at+16);
    if(len<0||at+20+len>base.length)throw Error('Truncated map cache data');
    if(!maps.has(name))kept.push(base.subarray(at,at+20+len));at+=20+len;
  }
  if(at!==base.length)throw Error('Map cache trailing data');
  for(const [name,{width,height,cells}] of maps){
    const compressed=zlib.deflateSync(cells),header=Buffer.alloc(20);header.write(name,0,11,'ascii');header.writeInt16LE(width,12);header.writeInt16LE(height,14);header.writeInt32LE(compressed.length,16);kept.push(header,compressed);
  }
  const header=Buffer.alloc(8);header.writeUInt16LE(base.readUInt16LE(4)+maps.size-[...maps.keys()].filter(name=>{
    let pos=8;for(let k=0;k<base.readUInt16LE(4);k++){const found=base.subarray(pos,pos+12).toString().split('\0')[0];if(found===name)return true;pos+=20+base.readInt32LE(pos+16);}return false;
  }).length,4);
  const result=Buffer.concat([header,...kept]);result.writeUInt32LE(result.length,0);return result;
}
export function validateCity(directory) {
  const city=JSON.parse(fs.readFileSync(path.join(directory,'city.json'))),maps=new Map();
  if(!Array.isArray(city.maps)||city.maps.length!==4||city.maps.some((n,k)=>n!=='er_chama'+k))throw Error('Unexpected city map names');
  for(const name of city.maps){
    const gat=readGat(fs.readFileSync(path.join(directory,'data',name+'.gat')));
    const gnd=fs.readFileSync(path.join(directory,'data',name+'.gnd')),rsw=fs.readFileSync(path.join(directory,'data',name+'.rsw'));
    if(gnd.subarray(0,4).toString()!=='GRGN'||gnd.readUInt32LE(6)*2!==gat.width||gnd.readUInt32LE(10)*2!==gat.height||rsw.subarray(0,4).toString()!=='GRSW'||!rsw.includes(Buffer.from(name+'.gnd'))||!rsw.includes(Buffer.from(name+'.gat')))throw Error('City world/terrain mismatch: '+name);
    const seen=new Set(),queue=[city.spawn];
    for(let k=0;k<queue.length;k++){const [x,y]=queue[k],id=y*gat.width+x;if(x<0||y<0||x>=gat.width||y>=gat.height||seen.has(id)||![0,2,3,4,6].includes(gat.cells[id]))continue;seen.add(id);queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
    for(const [x,y] of [city.spawn,city.exit,...city.npcs,...city.collection])if(!seen.has(y*gat.width+x))throw Error('Blocked city NPC, exit or spawn: '+name+' '+x+','+y);
    maps.set(name,gat);
  }
  return {city,maps};
}
export function prepareCity(root) {
  const {city,maps}=validateCity(path.join(root,'content/eridan')),engine=path.join(root,'engine/rathena');
  const cache=path.join(engine,'db/re/map_cache.dat');fs.writeFileSync(cache,cacheWithMaps(fs.readFileSync(cache),maps));
  const index=path.join(engine,'db/map_index.txt');let text=fs.readFileSync(index,'utf8');
  // Append names without explicit IDs; rAthena allocates unused IDs without replacing other maps.
  for(const name of city.maps)if(!text.split(/\r?\n/).some(line=>line.trim().split(/\s+/)[0]===name))text+='\n'+name;
  fs.writeFileSync(index,text+'\n');
  const conf=path.join(engine,'conf/maps_athena.conf');text=fs.readFileSync(conf,'utf8');for(const name of city.maps)if(!text.includes('map: '+name))text+='\nmap: '+name;fs.writeFileSync(conf,text+'\n');
  const custom=path.join(engine,'npc/scripts_custom.conf');text=fs.readFileSync(custom,'utf8');for(const script of ['chama-viva.txt','quest-start.txt']){const registration='npc: ../../rathena/'+script;if(!text.split(/\r?\n/).includes(registration))text+='\n'+registration;}fs.writeFileSync(custom,text+'\n');
  console.log('Chama Viva: four maps and matching server collisions prepared.');return city;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=path.resolve(process.argv[2]||'.');
  if(process.argv.includes('--validate')){const {city}=validateCity(path.join(root,'content/eridan'));console.log(JSON.stringify({valid:true,maps:city.maps,spawn:city.spawn}));}else prepareCity(root);
}
