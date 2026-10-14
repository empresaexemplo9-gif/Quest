import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {validateWorld,cacheWithMaps} from '../prepare-city.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),content=path.join(root,'content/eridan');
test('all shared regions, NPCs, gates and return arrivals are reachable',()=>{
 const {world,maps}=validateWorld(content);
 assert.equal(world.regions.length,18);assert.equal(world.routes.length,50);assert.equal(maps.size,22);
 for(const r of world.regions){const g=maps.get(r.id);
  for(let x=0;x<g.width;x++)assert.equal(g.cells[x],1);
  for(let y=0;y<g.height;y++)assert.equal(g.cells[y*g.width],1);
 }
});
test('native map cache contains every new collision grid and keeps existing maps',()=>{
 const {maps}=validateWorld(content),base=fs.readFileSync(path.join(root,'engine/rathena/db/re/map_cache.dat'));
 const result=cacheWithMaps(base,maps);assert.equal(result.readUInt32LE(0),result.length);
 const names=[];let at=8;
 for(let k=0;k<result.readUInt16LE(4);k++){names.push(result.subarray(at,at+12).toString().split('\0')[0]);at+=20+result.readInt32LE(at+16);}
 assert.equal(at,result.length);assert.ok(names.includes('prontera'));
 for(const name of maps.keys())assert.equal(names.filter(n=>n===name).length,1);
 assert.equal(cacheWithMaps(result,maps).compare(result),0);
});
test('one-way route is rejected before deployment',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'quest-world-'));
 try {
  fs.mkdirSync(path.join(temp,'data'));fs.copyFileSync(path.join(content,'city.json'),path.join(temp,'city.json'));
  for(const file of fs.readdirSync(path.join(content,'data')))if(/\.(rsw|gnd|gat)$/.test(file))fs.copyFileSync(path.join(content,'data',file),path.join(temp,'data',file));
  const world=JSON.parse(fs.readFileSync(path.join(content,'world.json')));world.routes.pop();fs.writeFileSync(path.join(temp,'world.json'),JSON.stringify(world));
  assert.throws(()=>validateWorld(temp),/One-way/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
