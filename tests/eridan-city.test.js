import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {validateCity,cacheWithMaps,readGat} from '../client/ragnarok/prepare-city.mjs';
const source=new URL('../content/eridan/',import.meta.url);
test('all reconstruction maps connect spawn, NPCs, collection and exit',()=>{
 const {city,maps}=validateCity(fileURLToPath(source));
 assert.equal(maps.size,4);assert.deepEqual(city.spawn,[48,28]);
 for(const gat of maps.values())assert.equal(gat.cells[48*gat.width+24],1,'workshop footprint is blocked');
});
test('map cache uses exactly the edited GAT cells, retains other maps and is idempotent',()=>{
 const {maps}=validateCity(fileURLToPath(source));
 const base=fs.readFileSync(new URL('../engine/rathena/db/re/map_cache.dat',import.meta.url));
 const updated=cacheWithMaps(base,maps);assert.equal(updated.readUInt16LE(4),base.readUInt16LE(4)+4);
 let at=8,found=0;
 for(let k=0;k<updated.readUInt16LE(4);k++){const name=updated.subarray(at,at+12).toString().split('\0')[0],len=updated.readInt32LE(at+16);if(maps.has(name)){assert.deepEqual(zlib.inflateSync(updated.subarray(at+20,at+20+len)),maps.get(name).cells);found++;}at+=20+len;}
 assert.equal(found,4);assert.equal(at,updated.length);assert.deepEqual(cacheWithMaps(updated,maps),updated);
 assert.throws(()=>cacheWithMaps(base.subarray(0,20),maps),/Invalid/);
});
test('applying edited maps refuses a blocked player spawn',()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'quest-city-'));
 try {fs.cpSync(source,temporary,{recursive:true});const filename=path.join(temporary,'data/er_chama0.gat'),gat=fs.readFileSync(filename);gat.writeUInt32LE(1,14+(28*gat.readUInt32LE(6)+48)*20+16);fs.writeFileSync(filename,gat);assert.throws(()=>validateCity(temporary),/Blocked/);}finally{assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir())+path.sep+'quest-city-'));fs.rmSync(temporary,{recursive:true,force:true});}
});
test('native GAT reader rejects truncated and unsupported cells',()=>{
 const gat=fs.readFileSync(new URL('../content/eridan/data/er_chama0.gat',import.meta.url));
 assert.throws(()=>readGat(gat.subarray(0,30)),/dimensions/);const corrupted=Buffer.from(gat);corrupted.writeUInt32LE(99,30);assert.throws(()=>readGat(corrupted),/cell/);
});
