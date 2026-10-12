import {cityBlocked} from './projection.js';
import {CLASSES,REGIONS,NPCS,CAMPAIGN,OPERATIONS,ITEMS,RECIPES,BUILDINGS,WEATHER,ENDINGS,CONTRACTS,SPECIALIZATIONS,WORLD,LEVEL_CAP} from './content.js';

export class GameError extends Error { constructor(message){super(message);this.name='GameError';} }
const requireRule=(condition,message)=>{if(!condition)throw new GameError(message);};
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const levelBand=level=>Math.floor((level-1)/10);
export const siegeOpen=now=>{const date=new Date(now);return date.getUTCDay()===6&&date.getUTCHours()>=18&&date.getUTCHours()<20;};
export const xpNeeded=level=>Math.floor(110+Math.pow(level,1.43)*48);
export function regionAt(x,y){return REGIONS[clamp(Math.floor(x/2400),0,3)+4*clamp(Math.floor(y/1800),0,1)];}
export function hash(value){let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
export function seeded(seed){let n=seed>>>0;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const clone=value=>structuredClone(value);
export function safeName(value,max=24){requireRule(typeof value==='string','Informe um nome.');const name=value.trim();requireRule(name.length>=2&&name.length<=max&&/^[\p{L}\p{N} ._'-]+$/u.test(name),'Use de 2 a '+max+' letras, números ou espaços.');return name;}

export function createWorld(now=Date.now(),seed=77){
 const world={schema:1,revision:0,seed,seq:1,startedAt:now,lastTick:now,players:{},monsters:{},nodes:{},guilds:{},parties:{},instances:{},listings:[],offers:[],duels:{},events:[],votes:{},season:{number:1,shards:[],ending:null,history:[],fronts:[]},towers:REGIONS.map(r=>({id:r.id,region:r.index,x:r.x+1800,y:r.y+500,owner:null,ownerUntil:0,capture:null})),convoys:{}};
 world.guilds.chama={id:'chama',name:'Chama Viva',leader:'mara',members:{},roles:{},specialization:'explorers',resources:{water:18,energy:18,food:18,materials:18},buildings:[],baseLevel:1,alliances:[],wars:[],contributions:{},lastUpkeep:now,crisis:false};
 for(const region of REGIONS){
  const random=seeded(seed+region.index*1337);
  for(let i=0;i<24;i++){
   const level=region.min+Math.floor(random()*Math.max(2,Math.min(8,region.max-region.min)));
   const x=region.x+820+random()*1350,y=region.y+520+random()*1150;
   const hp=65+level*9+Math.floor(level**1.32*4);
   world.monsters[`m${region.index}-${i}`]={id:`m${region.index}-${i}`,name:region.enemies[i%3],region:region.index,x,y,homeX:x,homeY:y,level,hp,maxHp:hp,attack:5+level*2.5,kind:i%3,boss:false,respawnAt:0,contributors:[],lastHit:0,effects:{},phase:0};
  }
  const bossLevel=Math.max(6,region.min+8),bossHp=350+bossLevel**1.5*24;
  world.monsters[`boss-${region.index}`]={id:`boss-${region.index}`,name:region.boss,region:region.index,x:region.x+1640,y:region.y+1120,homeX:region.x+1640,homeY:region.y+1120,level:bossLevel,hp:bossHp,maxHp:bossHp,attack:15+bossLevel*3.5,kind:3,boss:true,respawnAt:0,contributors:[],lastHit:0,effects:{},phase:0};
  for(let i=0;i<40;i++){
   const resource=['water','energy','materials','food','ether','data'][i%6];
   let x=region.x+390+random()*1780,y=region.y+500+random()*1150;
   if(i<6){x=region.x+540+(i%3)*96;y=region.y+540+Math.floor(i/3)*100;}
   world.nodes[`n${region.index}-${i}`]={id:`n${region.index}-${i}`,region:region.index,resource,x,y,availableAt:0};
  }
 }
 return world;
}

export function createPlayer(world,id,name,classId,now=Date.now()){
 requireRule(!Object.hasOwn(world.players,id),'Este Desperto já existe.');requireRule(Object.hasOwn(CLASSES,classId),'Escolha uma das cinco classes.');
 const p={id,name:safeName(name),classId,level:1,xp:0,x:385,y:490,hp:1,mana:1,attributes:clone(CLASSES[classId].attributes),attributePoints:0,skillPoints:0,skills:[1,0,0,0],cooldowns:{},promotion:null,ascension:false,finalForm:false,inventory:{potion:3,focus:2},resources:{water:0,energy:0,food:0,materials:0,ether:0,data:0},equipment:{weapon:null,accessory:null},credits:40,seals:0,honor:0,awakening:0,discovered:[0],towers:[],shards:[],lore:[],campaign:{index:0,active:null,progress:{},completed:[]},contracts:[],kills:0,guildId:null,partyId:null,pvp:false,duelId:null,effects:{},summon:null,mounted:false,stats:{gathered:0,donated:0,bosses:0,operations:0},operationWins:[],lastMove:now,lastAttack:0,lastSeen:now,lastGather:0,processed:[],messages:[],title:null,createdAt:now};
 world.players[id]=p;const stats=playerStats(world,p);p.hp=stats.maxHp;p.mana=stats.maxMana;message(p,'Seu Marcador de Éter despertou. Encontre Mara Voss no Abrigo 77.');return p;
}

export function playerStats(world,p){
 const definition=CLASSES[p.classId],attrs=p.attributes,weapon=ITEMS[p.equipment.weapon],accessory=ITEMS[p.equipment.accessory];
 const guild=world.guilds[p.guildId],building=id=>!!guild?.buildings.includes(id)&&!guild.crisis;
 const primary=p.classId==='archer'?attrs.dexterity:p.classId==='lumen'?attrs.intelligence*.75+attrs.faith*.5:p.classId==='umbra'?attrs.intelligence*.75+attrs.will*.5:attrs.strength;
 const promoted=p.promotion?1.12:1,final=p.finalForm?1.2:1;
 return {maxHp:Math.floor((definition.hp+p.level*15+attrs.vitality*7)*(building('hospital')?1.15:1)),maxMana:Math.floor((definition.mana+p.level*3+attrs.intelligence*3)*(guild?.specialization==='science'&&!guild.crisis?1.1:1)),attack:Math.floor((definition.attack+p.level*2.2+primary*1.6+(weapon?.power||0)+(accessory?.power||0))*promoted*final*(building('workshop')?1.1:1)*(guild?.specialization==='war'&&!guild.crisis?1.07:1)),defense:attrs.defense+p.level*.9+(building('defense')?12:0),range:definition.range+(p.promotion==='sniper'?90:0),speed:definition.speed*(p.mounted?1.75:1)*(p.effects.fury?1.15:1),crit:Math.min(.35,.04+attrs.perception*.008+(p.promotion==='phantom'?.09:0)),regen:building('hospital')?1.8:1};
}

function message(p,text){p.messageSeq=(p.messageSeq||0)+1;p.messages.push({id:p.messageSeq,text});p.messages=p.messages.slice(-25);}
function event(world,type,data){world.events.push({id:world.seq++,type,...data});world.events=world.events.slice(-70);}
function addItem(p,id,quantity=1){requireRule(Object.hasOwn(ITEMS,id),'Item desconhecido.');p.inventory[id]=(p.inventory[id]||0)+quantity;}
function removeItem(p,id,quantity=1){requireRule((p.inventory[id]||0)>=quantity,'Você não tem esse item.');p.inventory[id]-=quantity;if(!p.inventory[id])delete p.inventory[id];}
function addXp(world,p,amount){
 const guild=world.guilds[p.guildId];p.xp+=Math.floor(amount*(guild?.buildings.includes('lab')&&!guild.crisis?1.12:1));
 while(p.level<LEVEL_CAP&&p.xp>=xpNeeded(p.level)){p.xp-=xpNeeded(p.level);p.level++;p.attributePoints+=3;p.skillPoints++;const stats=playerStats(world,p);p.hp=stats.maxHp;p.mana=stats.maxMana;event(world,'level',{playerId:p.id,x:p.x,y:p.y,level:p.level});message(p,`Nível ${p.level}. Seu Éter se fortalece.`);}
 if(p.level===LEVEL_CAP)p.xp=0;
 if(p.level>=60&&p.promotion&&!p.finalForm){p.finalForm=true;message(p,`Forma Final desperta: ${CLASSES[p.classId].promotions.find(v=>v.id===p.promotion).final}.`);}
}
function progress(p,type,key,quantity=1,region=null){
 const quest=CAMPAIGN[p.campaign.index];
 if(p.campaign.active&&quest){quest.objectives.forEach((obj,index)=>{if(obj.type!==type&&!(obj.type==='shards'&&type==='shard'))return;if(obj.key&&obj.key!==key)return;if(obj.region!==undefined&&obj.region!==region)return;p.campaign.progress[index]=Math.min(obj.count,(p.campaign.progress[index]||0)+quantity);});}
 for(const contract of p.contracts){if(contract.type===type&&(!contract.region||contract.region===region))contract.progress=Math.min(contract.count,contract.progress+quantity);}
}
function partyMembers(world,p){return p.partyId&&world.parties[p.partyId]?world.parties[p.partyId].members.map(id=>world.players[id]).filter(Boolean):[p];}
function allies(world,p,radius=300){const duel=p.duelId&&world.duels[p.duelId];return Object.values(world.players).filter(v=>v.id===p.id||(duel?.active?duel.teams&&duel.teams[v.id]===duel.teams[p.id]:((p.partyId&&v.partyId===p.partyId)||(p.guildId&&v.guildId===p.guildId)))&&distance(v,p)<=radius&&v.hp>0);}
function livingNearby(world,p,radius){return Object.values(world.monsters).filter(m=>m.hp>0&&distance(m,p)<=radius&&(!m.instance||m.instance===p.instanceId));}
function safeHub(p){const r=regionAt(p.x,p.y);return Math.hypot(p.x-r.x-450,p.y-r.y-440)<220;}
export function weatherAt(world,now){const legacy=world.season.ending||world.season.legacy;const sequence=legacy==='reconstruction'?[0,3,0,1,3]:legacy==='dominion'?[0,2,4,1,2]:legacy==='balance'?[0,3,4,1,3]:[0,1,2,3,4];return WEATHER[sequence[Math.floor(Math.max(0,now-world.startedAt)/90000)%sequence.length]];}

export function terrain(region,seed=77){
 const random=seeded(seed+region.index*9187),props=[];
 for(let i=0;i<65;i++){const x=region.x+100+random()*2200,y=region.y+110+random()*1570;if(Math.hypot(x-region.x-450,y-region.y-440)<300||Math.abs(y-region.y-740)<55||Math.abs(x-region.x-1200)<65)continue;props.push({x,y,r:20+random()*24,type:i%4,size:26+random()*36});}
 return props;
}
const terrainCache=new Map();
function blocked(world,x,y){if(x<35||y<35||x>WORLD.width-35||y>WORLD.height-35)return true;const r=regionAt(x,y);if(cityBlocked({x,y},r))return true;const key=world.seed+':'+r.index;if(!terrainCache.has(key))terrainCache.set(key,terrain(r,world.seed));return terrainCache.get(key).some(o=>Math.hypot(o.x-r.x-450,o.y-r.y-440)>=670&&Math.hypot(x-o.x,y-o.y)<o.r+12);}
function move(world,p,dx,dy,now){
 requireRule(Number.isFinite(dx)&&Number.isFinite(dy),'Movimento inválido.');const length=Math.hypot(dx,dy);if(!length)return;
 const elapsed=clamp((now-p.lastMove)/1000,0,.3);p.lastMove=now;const stats=playerStats(world,p),speed=stats.speed*(p.effects.slow?.until>now?.55:1);dx=dx/length*speed*elapsed;dy=dy/length*speed*elapsed;
 if(!blocked(world,p.x+dx,p.y))p.x=clamp(p.x+dx,35,WORLD.width-35);if(!blocked(world,p.x,p.y+dy))p.y=clamp(p.y+dy,35,WORLD.height-35);
 const region=regionAt(p.x,p.y);if(!p.discovered.includes(region.index)){p.discovered.push(region.index);p.awakening+=3;event(world,'discover',{playerId:p.id,region:region.index,x:p.x,y:p.y});message(p,`Você descobriu ${region.name}.`);}
}

function respawn(world,p){
 const region=REGIONS[p.discovered[0]||0];p.x=region.x+385;p.y=region.y+490;p.effects={};p.mounted=false;const stats=playerStats(world,p);p.hp=stats.maxHp;p.mana=stats.maxMana;p.instanceId=null;message(p,'Mara encontrou você entre as cinzas. Seus itens foram preservados.');
}
export function canPvp(world,attacker,target,mode='duel'){
 if(!attacker||!target||attacker.id===target.id||attacker.level<=15||target.level<=15)return false;
 const duel=attacker.duelId&&world.duels[attacker.duelId];
 if(duel&&duel.active&&duel.members.includes(target.id)){if(duel.defeated?.includes(attacker.id)||duel.defeated?.includes(target.id))return false;if(duel.teams&&duel.teams[attacker.id]===duel.teams[target.id])return false;return duel.normalized||levelBand(attacker.level)===levelBand(target.level);}
 const war=attacker.guildId&&target.guildId&&attacker.guildId!==target.guildId&&world.guilds[attacker.guildId]?.wars.includes(target.guildId)&&world.guilds[target.guildId]?.wars.includes(attacker.guildId)&&world.towers.some(t=>distance(attacker,t)<550&&distance(target,t)<550);
 return mode==='open'&&attacker.pvp&&target.pvp&&(war||levelBand(attacker.level)===levelBand(target.level)&&regionAt(attacker.x,attacker.y).index===6&&regionAt(target.x,target.y).index===6);
}
function normalizedPvp(world,a,b){return !!(a.duelId&&world.duels[a.duelId]?.normalized)||!!(a.guildId&&b.guildId&&world.guilds[a.guildId]?.wars.includes(b.guildId));}
function normalizedAttack(p){const c=CLASSES[p.classId],primary=p.classId==='archer'?c.attributes.dexterity:['lumen','umbra'].includes(p.classId)?c.attributes.intelligence:c.attributes.strength;return c.attack+50*2.2+primary*1.6;}
function damagePlayer(world,target,amount,now,source=null){
 const normalized=source&&world.players[source.id]&&normalizedPvp(world,source,target),stats=playerStats(world,target),definition=CLASSES[target.classId];
 let taken=Math.max(1,amount-((normalized?definition.attributes.defense+45:stats.defense)*.38));
 if(normalized)taken*=stats.maxHp/(definition.hp+750+definition.attributes.vitality*7);
 if(source?.instance&&world.instances[source.instance]?.support.length)taken*=.38;
 taken=Math.floor(taken);
 if(target.effects.shield?.until>now){const used=Math.min(taken,target.effects.shield.amount);target.effects.shield.amount-=used;taken-=used;}
 target.hp=Math.max(0,target.hp-taken);event(world,'damage',{targetId:target.id,x:target.x,y:target.y,value:taken,color:'player'});
 if(target.effects.reflect?.until>now&&source?.id&&world.monsters[source.id])damageMonster(world,source,target,taken*.4,now);
 if(!target.hp){
  if(source&&world.players[source.id]&&target.duelId){const duel=world.duels[target.duelId];if(duel?.active){duel.defeated??=[];duel.defeated.push(target.id);const defeatedTeam=duel.teams?.[target.id],ended=!duel.teams||duel.members.filter(id=>duel.teams[id]===defeatedTeam).every(id=>duel.defeated.includes(id));if(ended){duel.active=false;const winners=duel.teams?duel.members.filter(id=>duel.teams[id]!==defeatedTeam):[source.id];for(const id of winners){world.players[id].honor+=15;world.players[id].seals+=2;world.players[id].awakening++;}for(const id of duel.members){const person=world.players[id];person.duelId=null;person.pvp=false;message(person,`Arena encerrada. Vitória de ${winners.map(id=>world.players[id].name).join(', ')}. Nenhum item foi perdido.`);}}}}
  respawn(world,target);
 }
}
function rewardMonster(world,monster,attacker,now){
 const participants=Object.values(world.players).filter(p=>p.hp>0&&now-p.lastSeen<15000&&distance(p,monster)<620&&(monster.contributors.includes(p.id)||p.id===attacker.id||(p.partyId&&p.partyId===attacker.partyId)));
 for(const p of participants){
  const guild=world.guilds[p.guildId];const credits=Math.floor((8+monster.level*3)*(guild?.buildings.includes('market')?1.15:1));p.credits+=credits;p.kills++;addXp(world,p,Math.floor(35+monster.level**1.32*25)*(monster.boss?3:1));progress(p,'kill',null,1,monster.region);
  if(monster.boss){p.stats.bosses++;p.awakening+=5;addItem(p,'ticket');const region=monster.region;if(region>0&&!p.shards.includes(region)){p.shards.push(region);progress(p,'shard',null,1,region);if(!world.season.shards.includes(region))world.season.shards.push(region);message(p,`Caco Maior de ${REGIONS[region].name} recuperado.`);}}
  const roll=seeded(hash(monster.id+':'+p.id+':'+world.seq))();if(roll<.24)addItem(p,roll<.08?'focus':'potion');
  event(world,'reward',{playerId:p.id,x:monster.x,y:monster.y,text:`+${credits} créditos · XP compartilhada`});
 }
 monster.hp=0;monster.respawnAt=now+(monster.boss?150000:32000);monster.contributors=[];
 if(monster.instance){const instance=world.instances[monster.instance];if(instance){instance.bossDefeated=true;instance.progress++;instance.phase=Math.min(instance.phase+1,OPERATIONS.find(o=>o.id===instance.operation).phases.length-1);}}
}
function damageMonster(world,monster,p,amount,now){
 if(monster.hp<=0)return;const shield=monster.effects.shield?.until>now?.55:1;const damage=Math.max(1,Math.floor(amount*shield*(monster.effects.curse?.until>now?1.15:1)));monster.hp=Math.max(0,monster.hp-damage);if(!monster.contributors.includes(p.id))monster.contributors.push(p.id);monster.targetId=p.id;event(world,'damage',{targetId:monster.id,playerId:p.id,x:monster.x,y:monster.y,value:damage,color:p.classId});
 if(!monster.hp)rewardMonster(world,monster,p,now);
}
function targetFor(world,p,targetId,range){
 if(world.monsters[targetId]){const target=world.monsters[targetId];requireRule(target.hp>0&&distance(p,target)<=range,'O alvo está fora de alcance.');requireRule(!target.instance||target.instance===p.instanceId,'Entre nessa operação primeiro.');return target;}
 if(world.players[targetId]){const target=world.players[targetId];requireRule(canPvp(world,p,target,'open'),'Esse Desperto não consentiu com um combate válido.');requireRule(distance(p,target)<=range,'O alvo está fora de alcance.');return target;}
 const target=livingNearby(world,p,range).sort((a,b)=>distance(p,a)-distance(p,b))[0];requireRule(target,'Nenhum inimigo ao alcance.');return target;
}
function attack(world,p,targetId,now){
 requireRule(now-p.lastAttack>=600,'Aguarde o próximo ataque.');const stats=playerStats(world,p),target=targetFor(world,p,targetId,stats.range);p.lastAttack=now;p.mounted=false;p.effects.combat={until:now+7000};
 let amount=world.players[target.id]&&normalizedPvp(world,p,target)?normalizedAttack(p):stats.attack;
 if(p.effects.fury?.until>now)amount*=1.45;const crit=seeded(hash(p.id+':'+now))()<(world.players[target.id]&&normalizedPvp(world,p,target)?.08:stats.crit);if(crit)amount*=1.7;
 if(world.players[target.id])damagePlayer(world,target,amount,now,p);else damageMonster(world,target,p,amount,now);
 event(world,'attack',{playerId:p.id,x:p.x,y:p.y,targetX:target.x,targetY:target.y,classId:p.classId,critical:crit});
 if(p.promotion==='reaper')p.hp=Math.min(stats.maxHp,p.hp+amount*.08);
}
function skill(world,p,slot,targetId,now){
 requireRule(Number.isInteger(slot)&&slot>=0&&slot<4,'Habilidade inválida.');const ability=CLASSES[p.classId].skills[slot];requireRule(p.level>=ability.level&&p.skills[slot]>0,'Essa habilidade ainda não foi aprendida.');requireRule(slot!==3||p.promotion,'Conclua sua Ascensão para usar essa habilidade.');requireRule((p.cooldowns[ability.id]||0)<=now,'Essa habilidade está recarregando.');requireRule(p.mana>=ability.cost,'Energia de Éter insuficiente.');
 const stats=playerStats(world,p);let power=stats.attack*ability.scale*(1+(p.skills[slot]-1)*.17),target;
 if(['shot','dash','control','curse','drain','execute'].includes(ability.kind))target=targetFor(world,p,targetId,ability.range);
 if(target&&world.players[target.id]&&normalizedPvp(world,p,target))power=normalizedAttack(p)*ability.scale;
 p.mana-=ability.cost;p.cooldowns[ability.id]=now+ability.cooldown*1000;p.mounted=false;
 if(p.classId==='umbra')p.hp=Math.max(1,p.hp-3);if(p.classId==='lumen')p.effects.exhaustion={until:now+2500};
 const hit=(m,n)=>world.players[m.id]?damagePlayer(world,m,normalizedPvp(world,p,m)?normalizedAttack(p)*ability.scale:n,now,p):damageMonster(world,m,p,n,now);
 switch(ability.kind){
  case 'heal':for(const ally of allies(world,p)){ally.hp=Math.min(playerStats(world,ally).maxHp,ally.hp+power*2);delete ally.effects.curse;event(world,'heal',{x:ally.x,y:ally.y,value:Math.floor(power*2),playerId:ally.id});}break;
  case 'shield':for(const ally of allies(world,p))ally.effects.shield={until:now+9000,amount:power*2.4};break;
  case 'buff':p.effects.fury={until:now+8000};break;
  case 'reflect':p.effects.reflect={until:now+10000};p.effects.shield={until:now+10000,amount:power};break;
  case 'summon':p.summon={until:now+18000,lastHit:0,power:stats.attack*.6,kind:p.classId};break;
  case 'taunt':for(const m of livingNearby(world,p,ability.range)){m.targetId=p.id;m.effects.taunt={until:now+8000,playerId:p.id};hit(m,power*.7);}p.effects.shield={until:now+8000,amount:power};break;
  case 'area':{const selected=world.monsters[targetId]||world.players[targetId];const center=selected&&distance(p,selected)<ability.range?selected:p;const targets=Object.values(world.monsters).filter(m=>m.hp>0&&distance(m,center)<(p.classId==='warrior'||p.classId==='tank'?ability.range:170)&&(!m.instance||m.instance===p.instanceId));for(const target of Object.values(world.players))if(canPvp(world,p,target,'open')&&distance(target,center)<170)targets.push(target);for(const m of targets)hit(m,power);break;}
  case 'dash':{const factor=Math.max(0,distance(p,target)-75)/Math.max(1,distance(p,target));const x=p.x+(target.x-p.x)*factor,y=p.y+(target.y-p.y)*factor;if(!blocked(world,x,y)){p.x=x;p.y=y;}hit(target,power);break;}
  case 'control':target.effects.slow={until:now+6500};hit(target,power);break;
  case 'curse':target.effects.curse={until:now+8000,power:power*.2,source:p.id,lastTick:now};hit(target,power*.7);break;
  case 'drain':hit(target,power);p.hp=Math.min(stats.maxHp,p.hp+power*(weatherAt(world,now).id==='eclipse'?.65:.4));break;
  case 'execute':hit(target,power*(target.hp/target.maxHp<.3?1.6:1));break;
  default:hit(target,power);
 }
 event(world,'skill',{playerId:p.id,x:p.x,y:p.y,classId:p.classId,kind:ability.kind,range:ability.range||150,targetX:target?.x,targetY:target?.y});
}

export function tickWorld(world,now=Date.now()){
 const dt=clamp((now-world.lastTick)/1000,0,1.2);if(dt<.05)return;world.lastTick=now;const weather=weatherAt(world,now);
 for(const tower of world.towers){
  if(tower.ownerUntil&&now>=tower.ownerUntil){tower.owner=null;tower.ownerUntil=0;}
  if(!tower.capture)continue;
  const capture=tower.capture,participants=Object.values(world.players).filter(p=>p.guildId===capture.guildId&&p.pvp&&p.level>15&&now-p.lastSeen<12000&&distance(p,tower)<160);
  const defenders=Object.values(world.players).filter(p=>p.guildId===tower.owner&&p.pvp&&p.level>15&&now-p.lastSeen<12000&&distance(p,tower)<220);
  if(!siegeOpen(now)||!participants.length){tower.capture=null;continue;}
  if(!defenders.length)capture.progress+=dt;
  if(capture.progress>=30){tower.owner=capture.guildId;tower.ownerUntil=now+86400000;tower.capture=null;world.guilds[tower.owner].resources.energy+=20;for(const p of participants)message(p,'Torre conquistada por 24 horas. A energia foi entregue à comunidade.');}
 }
 for(const p of Object.values(world.players)){
  if(now-p.lastSeen>12000)continue;const stats=playerStats(world,p);for(const key of Object.keys(p.effects)){if(p.effects[key].until<=now)delete p.effects[key];}
  p.mana=Math.min(stats.maxMana,p.mana+dt*(2+stats.maxMana*.008));if(safeHub(p)||!(p.effects.combat?.until>now))p.hp=Math.min(stats.maxHp,p.hp+dt*stats.regen*(safeHub(p)?10:1));
  if(weather.id==='acid'&&!safeHub(p)&&p.hp>4)p.hp-=dt*.8;if(weather.id==='aurora')p.hp=Math.min(stats.maxHp,p.hp+dt*1.2);
  p.oxygen??=100;const underwater=regionAt(p.x,p.y).index===5&&p.y>REGIONS[5].y+850&&!safeHub(p);p.oxygen=clamp(p.oxygen+dt*(underwater&&!(p.effects.pressure?.until>now)?-1.5:8),0,100);if(underwater&&p.oxygen<=0)damagePlayer(world,p,stats.maxHp*.025*dt,now);
  if(p.summon?.until>now&&now-p.summon.lastHit>1400){const enemy=livingNearby(world,p,440)[0];if(enemy){p.summon.lastHit=now;damageMonster(world,enemy,p,p.summon.power,now);event(world,'summon',{playerId:p.id,x:p.x,y:p.y,targetX:enemy.x,targetY:enemy.y});}}
  if(p.summon?.until<=now)p.summon=null;
  const convoy=world.convoys[p.id];if(convoy&&distance(p,convoy)<300){const tower=world.towers[convoy.region];const length=Math.hypot(tower.x-convoy.x,tower.y-convoy.y);if(length<35){progress(p,'escort',null);delete world.convoys[p.id];message(p,'Comboio entregue em segurança.');}else{convoy.x+=(tower.x-convoy.x)/length*dt*95;convoy.y+=(tower.y-convoy.y)/length*dt*95;}}
 }
 for(const instance of Object.values(world.instances)){if(instance.complete||!instance.support.length||now-(instance.lastSupport||0)<1600)continue;const p=world.players[instance.members[0]],boss=world.monsters[instance.bossId];if(!p||p.instanceId!==instance.id||now-p.lastSeen>12000||!boss||boss.hp<=0)continue;instance.lastSupport=now;const stats=playerStats(world,p);p.hp=Math.min(stats.maxHp,p.hp+stats.maxHp*.04);damageMonster(world,boss,p,stats.attack*.75,now);event(world,'support',{x:p.x+50,y:p.y+15,targetX:boss.x,targetY:boss.y,text:'SQUADRÃO NPC'});}
 for(const m of Object.values(world.monsters)){
  if(m.hp<=0){if(m.respawnAt&&now>=m.respawnAt&&!m.instance){m.hp=m.maxHp;m.x=m.homeX;m.y=m.homeY;m.effects={};m.targetId=null;}continue;}
  if(m.effects.curse?.until>now&&now-m.effects.curse.lastTick>=1000){m.effects.curse.lastTick=now;const source=world.players[m.effects.curse.source];if(source)damageMonster(world,m,source,m.effects.curse.power,now);}
  if(m.hp<=0)continue;const candidates=Object.values(world.players).filter(p=>now-p.lastSeen<12000&&p.hp>0&&!safeHub(p)&&(!m.instance||p.instanceId===m.instance)&&distance(m,p)<(m.boss?580:340));
  let target=m.effects.taunt?.until>now?world.players[m.effects.taunt.playerId]:candidates.find(p=>p.id===m.targetId)||candidates.sort((a,b)=>distance(a,m)-distance(b,m))[0];
  if(!target){if(distance(m,{x:m.homeX,y:m.homeY})>12){const d=distance(m,{x:m.homeX,y:m.homeY});m.x+=(m.homeX-m.x)/d*dt*65;m.y+=(m.homeY-m.y)/d*dt*65;}continue;}
  const d=distance(m,target),speed=(65+m.level*.6)*(m.effects.slow?.until>now?.25:1);if(d>65){m.x+=(target.x-m.x)/d*speed*dt;m.y+=(target.y-m.y)/d*speed*dt;}else if(now-m.lastHit>1300){m.lastHit=now;target.effects.combat={until:now+7000};damagePlayer(world,target,m.attack*(m.effects.taunt?.until>now?.75:1),now,m);}
  if(m.boss){const count=m.instance&&world.instances[m.instance]?.operation==='leviathan'?4:3;m.phase=Math.min(count-1,Math.floor((1-m.hp/m.maxHp)*count));if(d<180&&now-(m.lastPulse||0)>7000-m.phase*800){m.lastPulse=now;for(const p of candidates.filter(p=>distance(m,p)<180))damagePlayer(world,p,m.attack*(.7+m.phase*.15),now,m);event(world,'pulse',{x:m.x,y:m.y,radius:180+m.phase*15,kind:m.region});}}
 }
 for(const guild of Object.values(world.guilds)){if(now-guild.lastUpkeep>=120000){const periods=Math.min(5,Math.floor((now-guild.lastUpkeep)/120000));guild.lastUpkeep=now;for(const key of ['water','energy','food'])guild.resources[key]=Math.max(0,guild.resources[key]-periods*(1+Math.floor(guild.baseLevel/2)));if(guild.buildings.includes('greenhouse'))guild.resources.food+=periods*3;guild.crisis=['water','energy','food'].some(key=>guild.resources[key]===0);}}
 world.offers=world.offers.filter(o=>o.expires>now);
}

function talk(world,p,npcId){
 const npc=NPCS.find(n=>n.id===npcId);requireRule(npc&&distance(p,npc)<165,'Aproxime-se desse personagem.');progress(p,'talk',npcId);message(p,`${npc.name}: ${npc.dialogue}`);
 if(npcId==='mara'&&p.campaign.index>=2&&!p.guildId){joinGuild(world,p,'chama');world.guilds.chama.roles[p.id]='officer';message(p,'Mara confiou a você as oficinas da Chama Viva.');}
 if(npcId==='helios'&&p.campaign.index>=9&&!p.lore.includes('zenith')){p.lore.push('zenith');p.awakening+=5;}
}
function acceptQuest(world,p){
 const quest=CAMPAIGN[p.campaign.index];requireRule(quest,'Você concluiu a campanha desta temporada.');requireRule(!p.campaign.active,'Essa missão já está ativa.');const npc=NPCS.find(n=>n.id===quest.npc);requireRule(distance(p,npc)<180,'Fale com '+npc.name+' para receber a missão.');p.campaign.active=quest.id;p.campaign.progress={};
 quest.objectives.forEach((obj,index)=>{let value=0;if(obj.type==='guild'&&p.guildId)value=1;if(obj.type==='shards')value=p.shards.length;if(obj.type==='shard'&&p.shards.includes(obj.region))value=1;if(obj.type==='tower'&&p.towers.includes(obj.region))value=1;if(obj.type==='lore'&&p.lore.includes(obj.key))value=1;if(obj.type==='operation'&&p.operationWins.includes(obj.key))value=1;if(obj.type==='build'&&world.guilds[p.guildId]?.buildings.includes('workshop'))value=1;p.campaign.progress[index]=value;});message(p,'Missão iniciada: '+quest.title+'.');
}
function claimQuest(world,p){
 const quest=CAMPAIGN[p.campaign.index];requireRule(quest&&p.campaign.active===quest.id,'Nenhuma missão de história ativa.');requireRule(quest.objectives.every((o,i)=>(p.campaign.progress[i]||0)>=o.count),'Conclua todos os objetivos primeiro.');const npc=NPCS.find(n=>n.id===quest.npc);requireRule(distance(p,npc)<180,'Entregue a missão a '+npc.name+'.');p.campaign.completed.push(quest.id);p.campaign.index++;p.campaign.active=null;p.campaign.progress={};p.credits+=quest.credits;p.awakening+=3;addXp(world,p,quest.xp);
 if(quest.reward==='starter')addItem(p,'starter_'+p.classId);else if(quest.reward==='potion')addItem(p,'potion',3);else if(quest.reward==='token')addItem(p,'ticket',2);else if(quest.reward==='seal')p.seals+=8;else if(quest.reward==='ether')p.resources.ether+=5;else if(quest.reward==='insignia')addItem(p,'eraInsignia');message(p,'Missão concluída: '+quest.title+'. Sua recompensa está com você.');
}
function joinGuild(world,p,guildId){
 const guild=world.guilds[guildId];requireRule(guild,'Guilda não encontrada.');requireRule(!p.guildId,'Saia da sua guilda atual primeiro.');p.guildId=guildId;guild.members[p.id]=p.name;guild.roles[p.id]='recruit';progress(p,'guild',null);message(p,'Você se uniu à '+guild.name+'.');
}
function officer(world,p){const guild=world.guilds[p.guildId];requireRule(guild,'Entre em uma guilda primeiro.');requireRule(['leader','officer'].includes(guild.roles[p.id]),'Só líderes e oficiais podem decidir pela guilda.');return guild;}
function invite(world,p,type,targetId,now,extra={}){
 const target=world.players[targetId];requireRule(target&&target.id!==p.id,'Escolha outro Desperto.');requireRule(!world.offers.some(o=>o.type===type&&o.from===p.id&&o.to===targetId),'Esse convite já está aguardando uma resposta.');const offer={id:'o'+world.seq++,type,from:p.id,to:targetId,expires:now+60000,...extra};world.offers.push(offer);message(target,`${p.name} enviou um convite: ${type==='duel'?'Duelo de Honra':type==='party'?'grupo':type==='guild'?'guilda':type==='war'?'guerra de guildas':'aliança'}.`);return offer;
}
function offerResponse(world,p,id,accept,now){
 const offer=world.offers.find(v=>v.id===id&&v.to===p.id&&v.expires>now);requireRule(offer,'Esse convite expirou.');world.offers=world.offers.filter(v=>v.id!==id);if(!accept)return;const from=world.players[offer.from];requireRule(from,'O Desperto não está disponível.');
 if(offer.type==='party'){requireRule(!p.partyId,'Você já está em um grupo.');let party=world.parties[from.partyId];if(!party){party={id:'party'+world.seq++,leader:from.id,members:[from.id]};world.parties[party.id]=party;from.partyId=party.id;}requireRule(party.members.length<20,'Esse grupo está completo.');party.members.push(p.id);p.partyId=party.id;}
 else if(offer.type==='guild')joinGuild(world,p,from.guildId);
 else if(offer.type==='duel'){
  requireRule(p.level>15&&from.level>15,'Despertos até o nível 15 estão protegidos.');requireRule(!p.duelId&&!from.duelId,'Um dos Despertos já está em combate.');requireRule(offer.normalized||levelBand(p.level)===levelBand(from.level),'Os Despertos precisam estar na mesma faixa de dez níveis.');requireRule(distance(p,from)<700,'Aproxime-se do outro Desperto.');const duel={id:'duel'+world.seq++,members:[from.id,p.id],active:true,normalized:!!offer.normalized,createdAt:now};world.duels[duel.id]=duel;from.duelId=p.duelId=duel.id;from.pvp=p.pvp=true;}
 else if(offer.type==='alliance'||offer.type==='war'){const a=officer(world,from),b=officer(world,p);requireRule(a.id!==b.id,'Escolha outra guilda.');const key=offer.type==='alliance'?'alliances':'wars';if(!a[key].includes(b.id))a[key].push(b.id);if(!b[key].includes(a.id))b[key].push(a.id);}
 message(p,'Convite aceito.');message(from,p.name+' aceitou seu convite.');
}

function startOperation(world,p,operationId,now){
 const definition=OPERATIONS.find(o=>o.id===operationId);requireRule(definition,'Operação desconhecida.');requireRule(p.level>=definition.min,'Essa operação exige nível '+definition.min+'.');requireRule(regionAt(p.x,p.y).index===definition.region,'Viaje à região dessa operação.');requireRule(!p.instanceId,'Você já está em uma operação.');
 const party=partyMembers(world,p);requireRule(!p.partyId||world.parties[p.partyId].leader===p.id,'Somente o líder pode iniciar uma operação.');const members=party.filter(v=>distance(v,p)<650&&v.level>=definition.min&&now-v.lastSeen<15000);if(!world.solo){const minimum={glass:4,harvest:8,leviathan:15,aurea:6}[operationId],maximum={glass:6,harvest:10,leviathan:20,aurea:20}[operationId];requireRule(members.length>=minimum&&members.length<=maximum,`Essa operação exige de ${minimum} a ${maximum} Despertos elegíveis próximos.`);if(operationId==='aurea')requireRule(new Set(members.map(v=>v.guildId).filter(Boolean)).size>=2,'O cerco final exige uma coalizão de pelo menos duas guildas.');}const instance={id:'instance'+world.seq++,operation:operationId,members:members.map(v=>v.id),phase:0,progress:0,mechanics:[],choice:null,votes:{},bossDefeated:false,complete:false,createdAt:now,support:world.solo?Object.entries(CLASSES).filter(([id])=>id!==p.classId).map(([id,c])=>c.name+' NPC'):[],center:{x:REGIONS[definition.region].x+1600,y:REGIONS[definition.region].y+1100}};world.instances[instance.id]=instance;
 if(operationId==='aurea')instance.fronts=definition.mechanics.map((key,index)=>({key,x:instance.center.x+[-250,250,0][index],y:instance.center.y+[100,100,-250][index],readyAt:0,ready:false}));
 for(const member of members){member.instanceId=instance.id;member.x=instance.center.x-160;member.y=instance.center.y+70;message(member,'Operação iniciada: '+definition.name+(instance.support.length?'. Um esquadrão NPC da Chama Viva acompanha sua expedição solo.':'.'));}
 const hp=(320+definition.min**1.4*16)*(1+Math.max(0,members.length-1)*.4);const boss={id:instance.id+'-boss',name:definition.boss,region:definition.region,x:instance.center.x,y:instance.center.y,homeX:instance.center.x,homeY:instance.center.y,level:definition.min,hp,maxHp:hp,attack:12+definition.min*2.5,boss:true,instance:instance.id,contributors:[],effects:{shield:{until:now+600000}},lastHit:0,respawnAt:0,kind:3};world.monsters[boss.id]=boss;instance.bossId=boss.id;
}
function operationMechanic(world,p,key,now){
 const instance=world.instances[p.instanceId];requireRule(instance&&!instance.complete,'Entre em uma operação primeiro.');const definition=OPERATIONS.find(o=>o.id===instance.operation);requireRule(distance(p,instance.center)<450,'Aproxime-se do núcleo da operação.');const expected=definition.mechanics[instance.mechanics.length];
 if(instance.fronts){
  const front=instance.fronts.find(f=>f.key===key);requireRule(front&&!front.ready,'Essa frente já foi estabilizada.');requireRule(distance(p,front)<105,'Aproxime-se do sinal dessa frente do cerco.');
  if(!world.solo)requireRule(instance.members.filter(id=>{const m=world.players[id];return m&&m.instanceId===instance.id&&now-m.lastSeen<12000&&distance(m,front)<105;}).length>=2,'Cada frente exige dois participantes próximos.');
  for(const previous of instance.fronts)if(previous.ready&&now-previous.readyAt>60000){previous.ready=false;previous.readyAt=0;instance.mechanics=instance.mechanics.filter(k=>k!==previous.key);}
 }else{requireRule(key===expected,'Execute a próxima etapa: '+expected+'.');requireRule(now-(instance.lastMechanic||0)>1800,'Aguarde o ciclo do mecanismo.');}
 if(key==='Unir os Cacos')requireRule(world.season.shards.length>=7,'Reúna os sete Cacos Maiores primeiro.');
 instance.lastMechanic=now;if(instance.fronts){const front=instance.fronts.find(f=>f.key===key);front.ready=true;front.readyAt=now;}instance.mechanics.push(key);instance.phase=Math.min(instance.mechanics.length,definition.phases.length-1);const boss=world.monsters[instance.bossId];if(instance.mechanics.length>=definition.mechanics.length){delete boss.effects.shield;message(p,'As barreiras caíram. O núcleo está vulnerável.');}else message(p,'Etapa concluída: '+key+'.');event(world,'mechanic',{x:instance.center.x,y:instance.center.y,text:key});
 if(key==='Estabilizar pressão')for(const id of instance.members){world.players[id].oxygen=100;world.players[id].effects.pressure={until:now+90000};}
}
function completeOperation(world,p,choice,now){
 const instance=world.instances[p.instanceId];requireRule(instance&&!instance.complete,'Essa recompensa já foi entregue ou a operação não está ativa.');const definition=OPERATIONS.find(o=>o.id===instance.operation);requireRule(instance.bossDefeated&&instance.mechanics.length===definition.mechanics.length,'Complete os mecanismos e derrote o chefe primeiro.');
 if(definition.id==='harvest'){requireRule(['destroy','control','purify'].includes(choice),'Escolha o destino da estufa.');instance.votes[p.id]=choice;requireRule(instance.members.every(id=>instance.votes[id]),'Aguardando a escolha de todos os participantes.');const votes=Object.values(instance.votes);choice=[...new Set(votes)].sort((a,b)=>votes.filter(v=>v===b).length-votes.filter(v=>v===a).length||a.localeCompare(b))[0];instance.choice=choice;}
 instance.complete=true;
 for(const id of instance.members){const member=world.players[id];if(!member)continue;addItem(member,definition.material);addItem(member,(definition.id==='harvest'&&choice==='control'?'umbrafoliage':definition.set)+'_'+member.classId);addItem(member,'ticket');member.credits+=definition.credits;addXp(world,member,definition.xp);member.stats.operations++;member.awakening+=8;if(!member.operationWins.includes(definition.id))member.operationWins.push(definition.id);progress(member,'operation',definition.id);const roll=seeded(hash(instance.id+':'+id))();if(roll<.1)addItem(member,definition.rare);member.instanceId=null;message(member,definition.name+' concluída. Seu material, equipamento e ficha foram entregues individualmente.');
  if(definition.id==='harvest'){member.harvestChoice=choice;if(choice==='control'&&world.guilds[member.guildId])world.guilds[member.guildId].resources.food+=20;if(choice==='purify')member.resources.ether+=8;}
  if(!member.shards.includes(definition.region)){member.shards.push(definition.region);progress(member,'shard',null,1,definition.region);}if(!world.season.shards.includes(definition.region))world.season.shards.push(definition.region);
 }
 if(definition.id==='aurea')world.season.fronts=['Muralhas','Subsolo','Torre Central'];
}

export function performAction(world,playerId,action,now=Date.now()){
 const p=world.players[playerId];requireRule(p,'Desperto não encontrado.');requireRule(action&&typeof action.type==='string','Ação inválida.');
 if(action.id&&p.processed.includes(action.id))return {duplicate:true};tickWorld(world,now);p.lastSeen=now;
 const args=action.args||{};
 switch(action.type){
  case 'move':move(world,p,args.dx,args.dy,now);break;
  case 'attack':attack(world,p,args.targetId,now);break;
  case 'skill':skill(world,p,args.slot,args.targetId,now);break;
  case 'heartbeat':break;
  case 'chat':{requireRule(typeof args.text==='string'&&args.text.trim().length>0&&args.text.length<=180,'A mensagem deve ter até 180 caracteres.');requireRule(now-(p.lastChat||0)>700,'Aguarde um instante para enviar outra mensagem.');p.lastChat=now;event(world,'chat',{sender:p.name,text:args.text.trim(),x:p.x,y:p.y});break;}
  case 'talk':talk(world,p,args.npcId);break;
  case 'acceptQuest':acceptQuest(world,p);break;
  case 'claimQuest':claimQuest(world,p);break;
  case 'readLore':requireRule(['golden','rupture','ashes','awakening','shards','zenith','endings'].includes(args.chapter),'Registro desconhecido.');if(!p.lore.includes(args.chapter)){p.lore.push(args.chapter);p.awakening++;}progress(p,'lore',args.chapter);break;
  case 'gather':{const node=world.nodes[args.nodeId];requireRule(node&&distance(p,node)<100,'Aproxime-se do recurso.');requireRule(node.availableAt<=now,'Esse recurso está se regenerando.');requireRule(now-p.lastGather>450,'Aguarde a coleta.');p.lastGather=now;node.availableAt=now+35000;const amount=3+(p.guildId&&world.guilds[p.guildId]?.specialization==='explorers'?1:0);p.resources[node.resource]+=amount;p.stats.gathered+=amount;progress(p,'gather',node.resource,amount,node.region);addXp(world,p,15+node.region*10);event(world,'collect',{playerId:p.id,x:node.x,y:node.y,resource:node.resource,value:amount});break;}
  case 'equip':{const item=ITEMS[args.itemId];requireRule(item&&p.inventory[args.itemId],'Você não possui esse equipamento.');requireRule(!item.classId||item.classId===p.classId,'Esse equipamento pertence a outra classe.');requireRule(!item.level||p.level>=item.level,'Nível insuficiente para esse equipamento.');requireRule(['weapon','accessory'].includes(item.type),'Esse item não é um equipamento.');p.equipment[item.type]=args.itemId;message(p,'Equipado: '+item.name+'.');break;}
  case 'consume':{requireRule(['potion','focus'].includes(args.itemId),'Consumível inválido.');removeItem(p,args.itemId);const stats=playerStats(world,p);if(args.itemId==='potion')p.hp=Math.min(stats.maxHp,p.hp+stats.maxHp*.55);else p.mana=stats.maxMana;break;}
  case 'attribute':requireRule(Object.hasOwn(p.attributes,args.attribute)&&p.attributePoints>0,'Nenhum ponto disponível para esse atributo.');p.attributes[args.attribute]++;p.attributePoints--;break;
  case 'learnSkill':{const ability=CLASSES[p.classId].skills[args.slot];requireRule(ability&&p.level>=ability.level&&p.skillPoints>0,'Você ainda não pode aprender essa habilidade.');requireRule(p.skills[args.slot]<3,'Essa habilidade já está no máximo.');p.skills[args.slot]++;p.skillPoints--;break;}
  case 'ascension':requireRule(p.level>=30&&!p.promotion,'A Ascensão exige nível 30 e só pode ocorrer uma vez.');requireRule(p.stats.bosses>=1,'Enfrente um guardião de Éter para comprovar seu despertar.');requireRule(CLASSES[p.classId].promotions.some(v=>v.id===args.promotion),'Promoção inválida.');p.promotion=args.promotion;p.ascension=true;p.awakening+=10;message(p,'Ascensão concluída. Um novo caminho se abre.');if(p.level>=60)p.finalForm=true;break;
  case 'craft':{const recipe=RECIPES.find(v=>v.id===args.recipe),guild=world.guilds[p.guildId];requireRule(recipe,'Receita desconhecida.');requireRule(!recipe.level||p.level>=recipe.level,'A forja exige nível '+recipe.level+'.');requireRule(safeHub(p),'Visite uma oficina no abrigo para fabricar.');requireRule(p.credits>=Math.ceil(recipe.credits*(guild?.specialization==='artisans'&&!guild.crisis?.8:1)),'Créditos insuficientes.');for(const [key,amount]of Object.entries(recipe.cost))requireRule(p.resources[key]>=amount,'Você ainda não tem os materiais necessários.');for(const [key,amount]of Object.entries(recipe.cost))p.resources[key]-=amount;p.credits-=Math.ceil(recipe.credits*(guild?.specialization==='artisans'&&!guild.crisis?.8:1));addItem(p,recipe.item==='forged'?'forged_'+p.classId:recipe.item);p.awakening++;message(p,'Criação concluída: '+recipe.name+'.');break;}
  case 'mount':requireRule(p.inventory.bike||p.inventory.beast||p.inventory.convoy,'Fabrique ou dome uma montaria primeiro.');requireRule(!(p.effects.combat?.until>now),'Saia de combate antes de montar.');p.mounted=!p.mounted;break;
  case 'tower':{const tower=world.towers[args.region];requireRule(tower&&distance(p,tower)<160,'Aproxime-se da Torre de Sinal.');if(!p.towers.includes(args.region)){p.towers.push(args.region);p.awakening+=5;addXp(world,p,200+args.region*200);progress(p,'tower',null,1,args.region);}if(p.guildId&&!tower.owner){tower.owner=p.guildId;tower.ownerUntil=now+86400000;world.guilds[p.guildId].resources.energy+=10;}message(p,'Torre reativada. Viagem rápida disponível.');break;}
  case 'captureTower':{const tower=world.towers[args.region],guild=world.guilds[p.guildId];requireRule(tower&&guild&&distance(p,tower)<160,'Aproxime-se da torre e entre em uma guilda.');requireRule(siegeOpen(now),'Cerco semanal: sábado, das 18h às 20h UTC (15h–17h de Brasília).');requireRule(p.level>15&&p.pvp,'O cerco exige nível acima de 15 e adesão individual ao PvP.');requireRule(tower.owner&&tower.owner!==guild.id,'Escolha uma torre controlada por outra guilda.');requireRule(guild.wars.includes(tower.owner)&&world.guilds[tower.owner]?.wars.includes(guild.id),'Ambas as guildas precisam aceitar a guerra.');requireRule(!tower.capture||tower.capture.guildId===guild.id,'Outra guilda já disputa essa torre.');tower.capture??={guildId:guild.id,progress:0};message(p,'Permaneça na torre por 30 segundos. Defensores próximos interrompem a conquista.');break;}
  case 'travel':{requireRule(p.towers.includes(args.region),'Reative a torre dessa região primeiro.');requireRule(!(p.effects.combat?.until>now)&&!p.instanceId,'Não é possível viajar durante um combate ou operação.');const r=REGIONS[args.region];p.x=r.x+385;p.y=r.y+490;p.lastMove=now;break;}
  case 'joinGuild':requireRule(args.guildId==='chama','Outras guildas exigem convite.');joinGuild(world,p,args.guildId);break;
  case 'createGuild':{requireRule(!p.guildId,'Saia da sua guilda antes de fundar outra.');requireRule(p.partyId&&world.parties[p.partyId]?.members.length>=2,'Reúna pelo menos dois Despertos em um grupo para fundar uma guilda.');requireRule(p.credits>=200,'A fundação exige 200 créditos.');const name=safeName(args.name,30);requireRule(!Object.values(world.guilds).some(g=>g.name.toLocaleLowerCase()===name.toLocaleLowerCase()),'Esse nome de guilda já existe.');requireRule(Object.hasOwn(SPECIALIZATIONS,args.specialization),'Especialização inválida.');const id='g'+world.seq++;world.guilds[id]={id,name,leader:p.id,members:{},roles:{},specialization:args.specialization,resources:{water:8,energy:8,food:8,materials:8},buildings:[],baseLevel:1,alliances:[],wars:[],contributions:{},lastUpkeep:now,crisis:false};p.credits-=200;joinGuild(world,p,id);world.guilds[id].roles[p.id]='leader';break;}
  case 'leaveGuild':{const guild=world.guilds[p.guildId];requireRule(guild,'Você não pertence a uma guilda.');requireRule(guild.leader!==p.id||Object.keys(guild.members).length===1,'Transfira a liderança antes de sair.');delete guild.members[p.id];delete guild.roles[p.id];p.guildId=null;break;}
  case 'donate':{const guild=world.guilds[p.guildId];requireRule(guild,'Entre em uma guilda primeiro.');requireRule(['water','energy','food','materials'].includes(args.resource)&&Number.isInteger(args.amount)&&args.amount>0&&args.amount<=1000,'Contribuição inválida.');requireRule(p.resources[args.resource]>=args.amount,'Você não tem esses recursos.');p.resources[args.resource]-=args.amount;guild.resources[args.resource]+=args.amount;guild.contributions[p.id]=(guild.contributions[p.id]||0)+args.amount;p.stats.donated+=args.amount;p.seals+=Math.ceil(args.amount/3);p.awakening+=Math.ceil(args.amount/5);progress(p,'donate',null,args.amount);guild.crisis=['water','energy','food'].some(k=>guild.resources[k]===0);if(guild.id==='chama'&&guild.contributions[p.id]>=10)guild.roles[p.id]='officer';break;}
  case 'build':{const guild=officer(world,p),building=BUILDINGS.find(v=>v.id===args.building);requireRule(building&&!guild.buildings.includes(building.id),'Essa construção já existe ou é inválida.');for(const [key,amount]of Object.entries(building.cost))requireRule(guild.resources[key]>=amount,'A comunidade precisa de mais recursos.');for(const [key,amount]of Object.entries(building.cost))guild.resources[key]-=amount;guild.buildings.push(building.id);guild.baseLevel=guild.buildings.length>=5?3:guild.buildings.length>=2?2:1;progress(p,'build',null);p.seals+=5;message(p,'Construção concluída: '+building.name+'.');break;}
  case 'guildRole':{const guild=officer(world,p);requireRule(guild.leader===p.id,'Somente o líder pode alterar cargos.');requireRule(Object.hasOwn(guild.members,args.targetId)&&args.targetId!==guild.leader&&['officer','veteran','recruit'].includes(args.role),'Cargo ou membro inválido.');guild.roles[args.targetId]=args.role;break;}
  case 'transferLeader':{const guild=officer(world,p);requireRule(guild.leader===p.id&&Object.hasOwn(guild.members,args.targetId)&&args.targetId!==p.id,'Escolha outro membro da sua guilda para assumir a liderança.');guild.leader=args.targetId;guild.roles[args.targetId]='leader';guild.roles[p.id]='officer';message(p,'Liderança transferida para '+guild.members[args.targetId]+'.');break;}
  case 'inviteParty':invite(world,p,'party',args.targetId,now);break;
  case 'inviteGuild':officer(world,p);invite(world,p,'guild',args.targetId,now);break;
  case 'offerAlliance':case 'offerWar':{officer(world,p);const target=world.players[args.targetId];requireRule(target&&target.guildId&&target.guildId!==p.guildId,'Escolha um representante de outra guilda.');requireRule(['leader','officer'].includes(world.guilds[target.guildId].roles[target.id]),'Esse Desperto não representa sua guilda.');invite(world,p,action.type==='offerWar'?'war':'alliance',args.targetId,now);break;}
  case 'duel':requireRule(p.level>15&&!p.duelId,'Despertos até o nível 15 estão protegidos.');{const target=world.players[args.targetId];requireRule(target&&target.level>15,'Esse Desperto está protegido.');requireRule(args.normalized||levelBand(p.level)===levelBand(target.level),'Escolha um adversário na mesma faixa de dez níveis.');invite(world,p,'duel',args.targetId,now,{normalized:!!args.normalized});}break;
  case 'arenaQueue':{requireRule(p.level>15&&!p.duelId,'Despertos até o nível 15 estão protegidos.');requireRule([1,3,5].includes(args.size),'Modalidade de arena inválida.');world.arenaQueue??=[];world.arenaQueue=world.arenaQueue.filter(v=>v.playerId!==p.id);world.arenaQueue.push({playerId:p.id,size:args.size,band:levelBand(p.level),joinedAt:now});const waiting=world.arenaQueue.filter(v=>v.size===args.size&&v.band===levelBand(p.level)&&now-world.players[v.playerId].lastSeen<12000);if(waiting.length>=args.size*2){const members=waiting.slice(0,args.size*2).map(v=>v.playerId),id='arena'+world.seq++,teams=Object.fromEntries(members.map((id,index)=>[id,index<args.size?0:1]));world.duels[id]={id,members,teams,active:true,normalized:true,defeated:[],createdAt:now};world.arenaQueue=world.arenaQueue.filter(v=>!members.includes(v.playerId));const matchId=id;members.forEach((id,index)=>{const person=world.players[id];person.duelId=matchId;person.pvp=true;person.x=1050+(index<args.size?-120:120);person.y=880+(index%args.size)*55;person.hp=playerStats(world,person).maxHp;person.mana=playerStats(world,person).maxMana;message(person,`Arena ${args.size}×${args.size}: combate normalizado iniciado. Sua equipe exige consentimento voluntário.`);});}else message(p,`Arena ${args.size}×${args.size}: ${waiting.length}/${args.size*2} Despertos na sua faixa. Aguardando adversários.`);break;}
  case 'arenaCancel':world.arenaQueue=(world.arenaQueue||[]).filter(v=>v.playerId!==p.id);message(p,'Você saiu da fila da Arena.');break;
  case 'offerResponse':offerResponse(world,p,args.offerId,!!args.accept,now);break;
  case 'peaceful':if(args.enabled===false)requireRule(p.level>15,'Você está protegido até o nível 15.');p.pvp=args.enabled===false;if(args.enabled!==false&&p.duelId){const duel=world.duels[p.duelId];if(duel){duel.active=false;for(const id of duel.members){world.players[id].duelId=null;world.players[id].pvp=false;}}}break;
  case 'contract':{const definition=CONTRACTS.find(c=>c.id===args.contractId);requireRule(definition&&!p.contracts.some(c=>c.id===definition.id),'Esse contrato já está ativo ou é inválido.');p.contracts.push({...clone(definition),progress:0,region:regionAt(p.x,p.y).index});if(definition.id==='convoy'){const r=regionAt(p.x,p.y);world.convoys[p.id]={x:r.x+600,y:r.y+500,region:r.index};}break;}
  case 'claimContract':{const index=p.contracts.findIndex(c=>c.id===args.contractId);requireRule(index>=0&&p.contracts[index].progress>=p.contracts[index].count,'Conclua o contrato primeiro.');const contract=p.contracts.splice(index,1)[0];p.credits+=contract.credits;addXp(world,p,contract.xp*(1+contract.region*.5));p.awakening++;break;}
  case 'startOperation':startOperation(world,p,args.operationId,now);break;
  case 'mechanic':operationMechanic(world,p,args.key,now);break;
  case 'completeOperation':completeOperation(world,p,args.choice,now);break;
  case 'leaveOperation':{const instance=world.instances[p.instanceId];if(instance)instance.members=instance.members.filter(id=>id!==p.id);p.instanceId=null;respawn(world,p);break;}
  case 'redeem':requireRule(['crystal','foliage','tide','helios'].includes(args.set),'Série desconhecida.');{const itemId=args.set+'_'+p.classId;requireRule(p.level>=ITEMS[itemId].level,'Nível insuficiente para essa recompensa.');removeItem(p,'ticket');addItem(p,itemId);break;}
  case 'honorShop':requireRule(['cosmetic','solarTitle'].includes(args.itemId),'Recompensa de honra inválida.');{const cost=args.itemId==='cosmetic'?45:90;requireRule(p.honor>=cost,'Pontos de Honra insuficientes.');p.honor-=cost;addItem(p,args.itemId);if(args.itemId==='solarTitle')p.title='Guardião da Aurora';break;}
  case 'listItem':{const item=ITEMS[args.itemId];requireRule(item?.tradable,'Esse item está vinculado à sua conta e não pode ser negociado.');requireRule(Number.isInteger(args.price)&&args.price>0&&args.price<=100000,'Preço inválido.');requireRule(Number.isInteger(args.quantity)&&args.quantity>0&&args.quantity<=100,'Quantidade inválida.');removeItem(p,args.itemId,args.quantity);world.listings.push({id:'sale'+world.seq++,seller:p.id,sellerName:p.name,guildId:p.guildId,itemId:args.itemId,quantity:args.quantity,price:args.price,createdAt:now});break;}
  case 'listResource':{requireRule(['water','energy','food','materials','ether','data'].includes(args.resource),'Recurso inválido.');requireRule(Number.isInteger(args.price)&&args.price>0&&args.price<=100000&&Number.isInteger(args.quantity)&&args.quantity>0&&args.quantity<=1000,'Quantidade ou preço inválidos.');requireRule(p.resources[args.resource]>=args.quantity,'Você não possui esses recursos.');p.resources[args.resource]-=args.quantity;world.listings.push({id:'sale'+world.seq++,seller:p.id,sellerName:p.name,guildId:p.guildId,resource:args.resource,quantity:args.quantity,price:args.price,createdAt:now});break;}
  case 'cancelListing':{const index=world.listings.findIndex(l=>l.id===args.listingId&&l.seller===p.id);requireRule(index>=0,'Você não pode retirar esse anúncio.');const listing=world.listings[index];if(listing.resource)p.resources[listing.resource]+=listing.quantity;else addItem(p,listing.itemId,listing.quantity);world.listings.splice(index,1);break;}
  case 'buyItem':{const index=world.listings.findIndex(l=>l.id===args.listingId);requireRule(index>=0,'Esse item já foi vendido.');const listing=world.listings[index];requireRule(listing.seller!==p.id,'Você não pode comprar seu próprio anúncio.');requireRule(p.credits>=listing.price,'Créditos insuficientes.');const seller=world.players[listing.seller];requireRule(seller,'Vendedor não encontrado.');p.credits-=listing.price;seller.credits+=Math.floor(listing.price*(world.guilds[seller.guildId]?.specialization==='mercantile'||world.guilds[seller.guildId]?.buildings.includes('market')?.99:p.guildId&&p.guildId===listing.guildId?.98:.95));if(listing.resource)p.resources[listing.resource]+=listing.quantity;else addItem(p,listing.itemId,listing.quantity);world.listings.splice(index,1);break;}
  case 'vote':{requireRule(Object.hasOwn(ENDINGS,args.ending),'Destino inválido.');requireRule(world.season.shards.length>=7&&p.operationWins.includes('aurea'),'Complete o cerco final e reúna os sete Cacos primeiro.');requireRule(!world.season.ending,'O destino desta temporada já foi decidido.');world.votes[p.id]=args.ending;progress(p,'vote',null);const eligible=Object.values(world.players).filter(v=>v.operationWins.includes('aurea'));if(eligible.every(v=>world.votes[v.id])){const counts=Object.keys(ENDINGS).map(id=>({id,count:Object.values(world.votes).filter(v=>v===id).length})).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));world.season.ending=counts[0].id;world.season.history.push({number:world.season.number,ending:world.season.ending,at:now});for(const person of eligible){addItem(person,'eraInsignia');person.title='Desperto da Era Nova';message(person,ENDINGS[world.season.ending].text);}}break;}
  case 'nextSeason':requireRule(world.season.ending,'Conclua a temporada primeiro.');requireRule(world.solo||(['leader','officer'].includes(world.guilds[p.guildId]?.roles[p.id])&&Object.values(world.players).filter(v=>v.operationWins.includes('aurea')).every(v=>v.campaign.completed.includes('aurea-fall'))),'Os participantes precisam concluir a campanha; um líder ou oficial abre a próxima temporada.');{world.season.legacy=world.season.ending;world.season.number++;world.season.ending=null;world.season.shards=[];world.season.fronts=[];world.votes={};world.startedAt=now;for(const person of Object.values(world.players)){person.shards=[];person.operationWins=[];person.campaign={index:0,active:null,progress:{},completed:[]};}message(p,'Uma nova temporada começou. Sua classe e seus equipamentos foram preservados. O final anterior agora muda os eventos do continente.');break;}
  default:throw new GameError('Ação desconhecida.');
 }
 if(action.id){p.processed.push(action.id);p.processed=p.processed.slice(-64);}world.revision++;return {ok:true};
}

export function snapshot(world,playerId,now=Date.now()){
 const p=world.players[playerId];requireRule(p,'Desperto não encontrado.');const region=regionAt(p.x,p.y),stats=playerStats(world,p),quest=CAMPAIGN[p.campaign.index];
 return {schema:1,time:now,revision:world.revision,seed:world.seed,player:clone(p),stats,region:clone(region),weather:clone(weatherAt(world,now)),siegeOpen:siegeOpen(now),day:Math.floor((now-world.startedAt)/600000)+1,daylight:((now-world.startedAt)%600000)/600000,players:Object.values(world.players).filter(v=>v.id!==p.id&&now-v.lastSeen<12000).map(v=>({id:v.id,name:v.name,classId:v.classId,level:v.level,x:v.x,y:v.y,hp:v.hp,maxHp:playerStats(world,v).maxHp,guildId:v.guildId,pvp:v.pvp,duelId:v.duelId,mounted:v.mounted,promotion:v.promotion})),monsters:Object.values(world.monsters).filter(m=>m.hp>0&&distance(m,p)<1100&&(!m.instance||m.instance===p.instanceId)).map(clone),nodes:Object.values(world.nodes).filter(n=>distance(n,p)<1000).map(clone),npcs:NPCS.filter(n=>distance(n,p)<1600),towers:clone(world.towers),guilds:clone(Object.values(world.guilds)),party:clone(world.parties[p.partyId]||null),offers:clone(world.offers.filter(o=>o.to===p.id)),listings:clone(world.listings),arenaQueue:clone((world.arenaQueue||[]).filter(v=>v.playerId===p.id)),arenaCounts:[1,3,5].map(size=>({size,count:(world.arenaQueue||[]).filter(v=>v.size===size&&v.band===levelBand(p.level)).length})),season:clone(world.season),votes:clone(world.votes),instance:clone(world.instances[p.instanceId]||null),convoys:clone(Object.values(world.convoys)),events:clone(world.events.filter(e=>!e.playerId||e.playerId===p.id||e.type==='attack'||e.type==='skill')),quest:quest?{...clone(quest),progress:clone(p.campaign.progress),active:p.campaign.active===quest.id}:null,rankings:Object.values(world.players).map(v=>({name:v.name,level:v.level,honor:v.honor,awakening:v.awakening,guildId:v.guildId})).sort((a,b)=>b.honor-a.honor).slice(0,20)};
}
