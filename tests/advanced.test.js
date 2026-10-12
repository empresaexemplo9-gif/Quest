import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,createPlayer,performAction,playerStats,canPvp,weatherAt,siegeOpen,tickWorld} from '../public/game/core.js';
const NOW=Date.now();

test('3v3 and 5v5 arenas wait for consenting players, divide teams and block friendly fire',()=>{
 for(const size of [1,3,5]){
  const world=createWorld(NOW);world.monsters={};const players=[];
  for(let i=0;i<size*2;i++){const p=createPlayer(world,'p'+i,'Ari '+i,'warrior',NOW);p.level=20;players.push(p);performAction(world,p.id,{type:'arenaQueue',args:{size}},NOW+1);if(i<size*2-1)assert.equal(p.duelId,null);}
  const match=world.duels[players[0].duelId];assert.equal(match.normalized,true);assert.equal(match.members.length,size*2);assert.equal(world.arenaQueue.length,0);
  assert.equal(canPvp(world,players[0],players[size]),true);if(size>1)assert.equal(canPvp(world,players[0],players[1]),false);
 }
});

test('Normalized PvP ignores equipment and normalizes health loss across different levels',()=>{
 function hit(level,equipped){const world=createWorld(NOW);world.monsters={};const a=createPlayer(world,'attacker','Ari','warrior',NOW),b=createPlayer(world,'target','Nyra','warrior',NOW);a.level=20;b.level=level;a.x=1000;a.y=1000;b.x=1020;b.y=1000;if(equipped){a.inventory.helios_warrior=1;a.equipment.weapon='helios_warrior';a.attributes.strength=200;}b.hp=playerStats(world,b).maxHp;world.duels.d={id:'d',members:[a.id,b.id],normalized:true,active:true};a.duelId=b.duelId='d';const before=b.hp;performAction(world,a.id,{type:'attack',args:{targetId:b.id}},NOW+1);return (before-b.hp)/playerStats(world,b).maxHp;}
 assert.ok(Math.abs(hit(16,false)-hit(80,true))<.003);
});

test('Online raids enforce real participant minimums; solo support is explicitly identified',()=>{
 const world=createWorld(NOW),p=createPlayer(world,'a','Ari','archer',NOW);p.level=30;p.x=6400;p.y=1100;
 assert.throws(()=>performAction(world,p.id,{type:'startOperation',args:{operationId:'glass'}},NOW+1),/4 a 6/);
 world.solo=true;performAction(world,p.id,{type:'startOperation',args:{operationId:'glass'}},NOW+1);const instance=world.instances[p.instanceId];assert.equal(instance.members.length,1);assert.equal(instance.support.length,4);assert.ok(instance.support.every(name=>name.endsWith('NPC')));
});

test('Resource listings escrow stock, transfer once and return stock on cancellation',()=>{
 const world=createWorld(NOW);world.monsters={};const a=createPlayer(world,'a','Ari','warrior',NOW),b=createPlayer(world,'b','Nyra','archer',NOW);a.resources.materials=20;
 performAction(world,a.id,{type:'listResource',args:{resource:'materials',quantity:10,price:20}},NOW+1);assert.equal(a.resources.materials,10);const sale=world.listings[0];
 performAction(world,b.id,{type:'buyItem',args:{listingId:sale.id}},NOW+2);assert.equal(b.resources.materials,10);assert.equal(b.credits,20);assert.equal(a.credits,59);
 performAction(world,a.id,{type:'listResource',args:{resource:'materials',quantity:10,price:20}},NOW+3);performAction(world,a.id,{type:'cancelListing',args:{listingId:world.listings[0].id}},NOW+4);assert.equal(a.resources.materials,10);
});

test('Season endings alter the following season rather than only displaying narrative text',()=>{
 const world=createWorld(NOW);world.solo=true;const p=createPlayer(world,'a','Ari','lumen',NOW);world.season.ending='reconstruction';performAction(world,p.id,{type:'nextSeason'},NOW+1);assert.equal(world.season.legacy,'reconstruction');assert.equal(world.season.number,2);assert.equal(weatherAt(world,NOW+90001).id,'aurora');
});

test('Weekly tower sieges require bilateral war and individual consent; defenders pause capture',()=>{
 const now=Date.UTC(2026,9,17,18,10),world=createWorld(now);world.monsters={};
 const a=createPlayer(world,'a','Ari','warrior',now),b=createPlayer(world,'b','Nyra','tank',now);a.level=b.level=25;
 world.guilds.rival=structuredClone(world.guilds.chama);world.guilds.rival.id='rival';a.guildId='chama';b.guildId='rival';
 const tower=world.towers[0];tower.owner='rival';tower.ownerUntil=now+86400000;a.x=b.x=tower.x;a.y=b.y=tower.y;
 assert.equal(siegeOpen(now),true);assert.equal(siegeOpen(now+7200000),false);
 assert.throws(()=>performAction(world,a.id,{type:'captureTower',args:{region:0}},now+1),/adesão individual/);
 a.pvp=true;assert.throws(()=>performAction(world,a.id,{type:'captureTower',args:{region:0}},now+2),/aceitar a guerra/);
 world.guilds.chama.wars=['rival'];world.guilds.rival.wars=['chama'];
 performAction(world,a.id,{type:'captureTower',args:{region:0}},now+3);b.pvp=true;
 tickWorld(world,now+1000);assert.equal(tower.capture.progress,0);b.x+=500;
 for(let i=2;i<=33;i++){a.lastSeen=now+i*1000;tickWorld(world,now+i*1000);}
 assert.equal(tower.owner,'chama');assert.equal(tower.capture,null);assert.ok(tower.ownerUntil>=now+86400000);
 tickWorld(world,tower.ownerUntil+1);assert.equal(tower.owner,null);
});
