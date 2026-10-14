import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {decodeOutfit,encodeOutfit,encodeCreationPlan} from '../mods/OutfitLogic.js';

test('wardrobe dyes reach boots, preserve faces and keep black darker than silver',()=>{
 for(const name of ['novice','sword','mage','archer','acolyte','merchant','thief'])for(const style of ['standard','epic']){
  const base=path.resolve('content/ragnarok/data/sprite/quest',name+'-'+style),spr=fs.readFileSync(base+'.spr'),natural=spr.subarray(-1024);
  const width=spr.readUInt16LE(8),height=spr.readUInt16LE(10),pixels=spr.subarray(12,12+width*height);
  const head=new Set(pixels.subarray(0,Math.floor(height*.38)*width)),boots=new Set(pixels.subarray(Math.ceil(height*.82)*width));head.delete(0);boots.delete(0);
  for(let color=1;color<8;color++){
   const pal=fs.readFileSync(base+'-'+color+'.pal');assert.deepEqual(pal.subarray(0,4),Buffer.alloc(4));
   for(const i of head)assert.deepEqual(pal.subarray(i*4,i*4+4),natural.subarray(i*4,i*4+4),'Head changed: '+name+'/'+style);
   assert.ok([...boots].some(i=>!pal.subarray(i*4,i*4+3).equals(natural.subarray(i*4,i*4+3))),'Boot dye missing: '+name+'/'+style+'/'+color);
  }
  const silver=fs.readFileSync(base+'-6.pal'),black=fs.readFileSync(base+'-7.pal');
  const light=(pal)=>[...boots].reduce((sum,i)=>sum+.299*pal[i*4]+.587*pal[i*4+1]+.114*pal[i*4+2],0)/boots.size;
  assert.ok(light(silver)>light(black)+10,'Black/silver boots indistinguishable: '+name+'/'+style);
 }
});
test('GM creation plans preserve every level, family and dye within the native signed packet field',()=>{const codes=new Set();for(let family=0;family<7;family++)for(let level=1;level<=275;level++)for(let color=0;color<8;color++){const code=encodeCreationPlan(family,level,color);assert.ok(code<=32767);assert.ok(!codes.has(code));codes.add(code);const encoded=code-10000;assert.equal(Math.floor(encoded/2300),family);assert.equal(Math.floor((encoded%2300)/8)+1,level);assert.equal((encoded%2300)%8,color);}for(const level of [0,276,1.5,NaN])assert.throws(()=>encodeCreationPlan(0,level));});
test('native persistent codes cover every class, both outfits and eight colours without collisions',()=>{const codes=new Set();for(let family=0;family<7;family++)for(const epic of [false,true])for(let color=0;color<8;color++){const code=encodeOutfit(family,epic,color);assert.ok(!codes.has(code));codes.add(code);const decoded=decodeOutfit(code);assert.equal(decoded.family,family);assert.equal(decoded.style,epic?'epic':'standard');assert.equal(decoded.color,color);}assert.equal(codes.size,112);for(const invalid of [0,7,99,212,-1,NaN,100.5])assert.equal(decodeOutfit(invalid),null);});
test('every selected costume has complete native assets and distinct dye palettes',()=>{for(let family=0;family<7;family++)for(const epic of [false,true]){const d=decodeOutfit(encodeOutfit(family,epic)),base=path.resolve('content/ragnarok/data/sprite/quest',d.name+'-'+d.style);const spr=fs.readFileSync(base+'.spr'),act=fs.readFileSync(base+'.act');assert.equal(spr.subarray(0,2).toString(),'SP');assert.equal(spr.readUInt16LE(4),56);assert.equal(act.subarray(0,2).toString(),'AC');assert.equal(act.readUInt16LE(4),104);const variants=new Set();for(let c=1;c<8;c++){const pal=fs.readFileSync(base+'-'+c+'.pal');assert.equal(pal.length,1024);variants.add(pal.toString('hex'));}assert.equal(variants.size,7);}});
