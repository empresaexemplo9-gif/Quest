import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,createPlayer,performAction,snapshot,playerStats,canPvp,xpNeeded,GameError} from '../public/game/core.js';
import {CLASSES,OPERATIONS,REGIONS} from '../public/game/content.js';

const NOW=Date.now();
function setup(classId='warrior'){const world=createWorld(NOW);world.monsters={};const player=createPlayer(world,'a','Ari',classId,NOW);return {world,player};}
function act(world,p,type,args={},offset=1){return performAction(world,p.id,{type,args},NOW+offset);}

test('Mara quest requires actual collection and pays once',()=>{
 const {world,player:p}=setup();act(world,p,'talk',{npcId:'mara'});act(world,p,'acceptQuest');
 assert.throws(()=>act(world,p,'claimQuest'),GameError);
 for(const [nodeId,t]of [['n0-0',1000],['n0-1',2000]]){const node=world.nodes[nodeId];p.x=node.x;p.y=node.y;act(world,p,'gather',{nodeId},t);}
 assert.equal(p.resources.water,3);assert.equal(p.resources.energy,3);
 p.x=430;p.y=430;act(world,p,'claimQuest',{},3000);
 assert.equal(p.campaign.index,1);assert.equal(p.credits,110);assert.ok(p.level>1);
 assert.throws(()=>act(world,p,'claimQuest',{},3100),GameError);assert.equal(p.credits,110);
});

test('All five classes have functional first skills with cooldown and resource costs',()=>{
 for(const classId of Object.keys(CLASSES)){
  const {world,player:p}=setup(classId);p.x=1000;p.y=1000;p.hp=25;
  const monster={id:'dummy',name:'Drone de teste',x:1030,y:1000,homeX:1030,homeY:1000,level:1,region:0,hp:500,maxHp:500,attack:0,contributors:[],effects:{},lastHit:0};world.monsters.dummy=monster;
  const mana=p.mana;act(world,p,'skill',{slot:0,targetId:'dummy'});
  assert.ok(p.mana<mana);assert.throws(()=>act(world,p,'skill',{slot:0,targetId:'dummy'},10),GameError);
  if(classId==='lumen')assert.ok(p.hp>25);else if(classId==='tank')assert.ok(p.effects.shield.amount>0);else assert.ok(monster.hp<500);
 }
});

test('Novice protection includes level 15; consent and ten-level bands are enforced',()=>{
 const {world,player:a}=setup();const b=createPlayer(world,'b','Nyra','archer',NOW);a.level=15;b.level=16;
 assert.equal(canPvp(world,a,b),false);assert.throws(()=>act(world,a,'duel',{targetId:b.id}),GameError);
 a.level=20;b.level=21;assert.throws(()=>act(world,a,'duel',{targetId:b.id}),GameError);
 b.level=20;const inventory=structuredClone(b.inventory);act(world,a,'duel',{targetId:b.id});assert.equal(canPvp(world,a,b),false);
 const offer=world.offers[0];assert.throws(()=>act(world,a,'offerResponse',{offerId:offer.id,accept:true}),GameError);
 act(world,b,'offerResponse',{offerId:offer.id,accept:true});assert.equal(canPvp(world,a,b),true);
 b.hp=1;act(world,a,'attack',{targetId:b.id},30);assert.deepEqual(b.inventory,inventory);assert.equal(b.pvp,false);assert.equal(a.honor,15);
});

test('Party invitations require the target acceptance and enable shared boss loot',()=>{
 const {world,player:a}=setup();const b=createPlayer(world,'b','Nyra','lumen',NOW);
 act(world,a,'inviteParty',{targetId:'b'});assert.equal(b.partyId,null);act(world,b,'offerResponse',{offerId:world.offers[0].id,accept:true});assert.equal(a.partyId,b.partyId);
 a.x=b.x=1000;a.y=b.y=1000;
 const boss={id:'boss',name:'Guardião',x:1020,y:1000,homeX:1020,homeY:1000,hp:1,maxHp:100,level:16,region:1,boss:true,attack:0,contributors:[],effects:{},lastHit:0};world.monsters.boss=boss;
 act(world,a,'attack',{targetId:'boss'});assert.equal(a.inventory.ticket,1);assert.equal(b.inventory.ticket,1);assert.ok(a.shards.includes(1)&&b.shards.includes(1));assert.ok(a.xp>0||a.level>1);assert.ok(b.xp>0||b.level>1);
});

test('Crafting consumes actual materials and account-bound rewards cannot enter market',()=>{
 const {world,player:p}=setup();p.resources.water=2;p.resources.food=1;const previous=p.inventory.potion;act(world,p,'craft',{recipe:'potion'});assert.equal(p.resources.water,0);assert.equal(p.resources.food,0);assert.equal(p.inventory.potion,previous+1);
 p.inventory.ticket=1;assert.throws(()=>act(world,p,'listItem',{itemId:'ticket',price:10,quantity:1}),GameError);
 const b=createPlayer(world,'b','Nyra','archer',NOW);act(world,p,'listItem',{itemId:'potion',price:20,quantity:1});const id=world.listings[0].id;const before=b.inventory.potion;act(world,b,'buyItem',{listingId:id});assert.equal(b.inventory.potion,before+1);assert.equal(b.credits,20);assert.throws(()=>act(world,b,'buyItem',{listingId:id}),GameError);
});

test('Guild resource permissions, buildings and crisis affect actual statistics',()=>{
 const {world,player:p}=setup();act(world,p,'joinGuild',{guildId:'chama'});assert.throws(()=>act(world,p,'build',{building:'workshop'}),GameError);
 p.resources.materials=100;act(world,p,'donate',{resource:'materials',amount:10});assert.equal(world.guilds.chama.roles[p.id],'officer');const guild=world.guilds.chama;guild.resources={water:100,energy:100,food:100,materials:100};
 const before=playerStats(world,p).attack;act(world,p,'build',{building:'workshop'});assert.ok(playerStats(world,p).attack>before);assert.throws(()=>act(world,p,'build',{building:'workshop'}),GameError);
 guild.crisis=true;assert.equal(playerStats(world,p).attack,before);
});

test('The four operations require their mechanisms, boss victory and deliver nonduplicating rewards',()=>{
 for(const definition of OPERATIONS){
  const {world,player:p}=setup('archer');world.solo=true;p.level=definition.min;p.hp=playerStats(world,p).maxHp;p.mana=playerStats(world,p).maxMana;p.x=REGIONS[definition.region].x+1500;p.y=REGIONS[definition.region].y+1050;world.season.shards=[1,2,3,4,5,6,7];
  act(world,p,'startOperation',{operationId:definition.id});const instance=world.instances[p.instanceId];assert.throws(()=>act(world,p,'completeOperation',{choice:'purify'}),GameError);
  let t=2500;for(const key of definition.mechanics){if(instance.fronts){const front=instance.fronts.find(f=>f.key===key);p.x=front.x;p.y=front.y;}act(world,p,'mechanic',{key},t);t+=2500;}
  const boss=world.monsters[instance.bossId];boss.hp=1;p.x=boss.x-100;p.y=boss.y;
  // Keep the final hit under this test's control; NPC support otherwise kills a one-HP fixture during the tick.
  instance.lastSupport=NOW+t;act(world,p,'attack',{targetId:boss.id},t);
  act(world,p,'completeOperation',{choice:'purify'},t+10);assert.equal(p.inventory[definition.material],1);assert.ok(p.operationWins.includes(definition.id));assert.equal(instance.complete,true);
  assert.throws(()=>act(world,p,'completeOperation',{choice:'purify'},t+20),GameError);assert.equal(p.inventory[definition.material],1);
 }
});

test('Ascension and final form respect level thresholds; level cap remains 80',()=>{
 const {world,player:p}=setup();p.level=29;p.stats.bosses=1;assert.throws(()=>act(world,p,'ascension',{promotion:'gladiator'}),GameError);p.level=30;act(world,p,'ascension',{promotion:'gladiator'});assert.equal(p.promotion,'gladiator');assert.throws(()=>act(world,p,'ascension',{promotion:'phantom'}),GameError);
 p.level=79;p.xp=xpNeeded(79)-1;p.x=1000;p.y=1000;world.monsters.test={id:'test',x:1010,y:1000,hp:1,maxHp:1,level:80,region:7,attack:0,contributors:[],effects:{},lastHit:0};act(world,p,'attack',{targetId:'test'},100);assert.equal(p.level,80);assert.equal(p.xp,0);assert.equal(p.finalForm,true);
});

test('Final season result requires seven shards and the votes of all raid participants',()=>{
 const {world,player:a}=setup();const b=createPlayer(world,'b','Nyra','lumen',NOW);a.operationWins=b.operationWins=['aurea'];
 assert.throws(()=>act(world,a,'vote',{ending:'balance'}),GameError);world.season.shards=[1,2,3,4,5,6,7];act(world,a,'vote',{ending:'balance'});assert.equal(world.season.ending,null);act(world,b,'vote',{ending:'balance'});assert.equal(world.season.ending,'balance');assert.equal(a.inventory.eraInsignia,1);assert.equal(b.inventory.eraInsignia,1);assert.throws(()=>act(world,a,'vote',{ending:'dominion'}),GameError);
});

test('An action id cannot give duplicated loot or rewards',()=>{
 const {world,player:p}=setup();const node=world.nodes['n0-0'];p.x=node.x;p.y=node.y;const action={id:'request-0001',type:'gather',args:{nodeId:node.id}};performAction(world,p.id,action,NOW+1000);performAction(world,p.id,action,NOW+40000);assert.equal(p.resources.water,3);
 assert.equal(snapshot(world,p.id,NOW+40000).player.resources.water,3);
});
