import test from 'node:test';
import assert from 'node:assert/strict';
import {project,unproject,cityBlocked} from '../public/game/projection.js';
import {createWorld,createPlayer,performAction} from '../public/game/core.js';
import {REGIONS} from '../public/game/content.js';

test('Isometric pointer projection round-trips world coordinates across every region',()=>{
 for(const region of REGIONS)for(const offset of [{x:385,y:490},{x:1600,y:1100},{x:2300,y:1700}]){
  const world={x:region.x+offset.x,y:region.y+offset.y},back=unproject(project(world));
  assert.ok(Math.abs(world.x-back.x)<1e-9);assert.ok(Math.abs(world.y-back.y)<1e-9);
 }
});

test('The city plaza stays walkable while building footprints block movement',()=>{
 const region=REGIONS[0];assert.equal(cityBlocked({x:385,y:490},region),false);
 const house=unproject({x:(150-768)*1.45,y:(200-620)*1.45});house.x+=450;house.y+=440;
 assert.equal(cityBlocked(house,region),true);
 const now=Date.now(),world=createWorld(now),p=createPlayer(world,'a','Ari','warrior',now);world.monsters={};p.x=house.x;p.y=house.y;
 const before={x:p.x,y:p.y};performAction(world,p.id,{type:'move',args:{dx:1,dy:1}},now+150);assert.deepEqual({x:p.x,y:p.y},before);
});
