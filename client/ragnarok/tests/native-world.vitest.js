import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import RSM from 'Loaders/Model.js';
import GND from 'Loaders/Ground.js';
import RSW from 'Loaders/World.js';
const data=path.resolve(process.env.QUEST_WORLD_DATA || '../../../content/eridan/data');
function buffer(file){const b=fs.readFileSync(path.join(data,file)),result=new ArrayBuffer(b.length);new Uint8Array(result).set(b);return result;}
describe('Eridan native renderer assets',()=>{
  for(const name of fs.readdirSync(data).filter(n=>n.endsWith(".rsw")).map(n=>n.slice(0,-4)))it('parses shared map '+name,()=>{
    const world=new RSW(buffer(name+'.rsw'));
    const ground=new GND(buffer(name+'.gnd'));
    expect(world.models.length).toBeGreaterThan(40);
    expect(ground.lightmap.count).toBe(6400);
    expect(ground.surfaces.length).toBe(6400);
    for(const tile of ground.tiles){expect(tile.light).toBeLessThan(ground.lightmap.count);expect(tile.texture).toBeLessThan(ground.textures.length);}
    for(const model of world.models)expect(fs.existsSync(path.join(data,'model',model.filename))).toBe(true);
    for(const material of ground.textures)expect(fs.existsSync(path.join(data,'texture',material))).toBe(true);
  });
  for(const filename of fs.readdirSync(path.join(data,'model/eridan')))it('parses model '+filename,()=>{
    const model=new RSM(buffer('model/eridan/'+filename));
    expect(model.nodes.length).toBeGreaterThan(0);
    for(const node of model.nodes)for(const face of node.faces){
      expect(face.vertidx.every(k=>k<node.vertices.length)).toBe(true);
      expect(face.tvertidx.every(k=>k*6<node.tvertices.length)).toBe(true);
      expect(face.texid).toBeLessThan(node.textures.length);
    }
  });
});

const city=JSON.parse(fs.readFileSync(path.resolve(data,'../city.json')));
const shared=JSON.parse(fs.readFileSync(path.resolve(data,'../world.json')));
it('aligns native visual structures with server collision coordinates',()=>{
 for(const [id,colliders] of [['er_chama3',city.structures.concat(city.props)],...shared.regions.map(r=>[r.id,r.colliders])]) {
  const world=new RSW(buffer(id+'.rsw')); const ground=new GND(buffer(id+'.gnd'));
  for(const a of colliders){
   const matches=world.models.filter(m=>m.filename==='eridan/'+a.model+'.rsm');
   expect(matches.some(m=>Math.abs(m.position[0]+ground.width-a.x)<.001&&Math.abs(m.position[2]+ground.height-a.y)<.001)).toBe(true);
  }
 }
});
