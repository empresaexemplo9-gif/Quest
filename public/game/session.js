import {CLASSES} from './content.js';
import {createWorld,createPlayer,performAction,snapshot} from './core.js';
const SAVE_KEY='eridan-solo-v1';
const actionId=()=>crypto.randomUUID().replaceAll('-','');
export function hasSave(){try{return !!localStorage.getItem(SAVE_KEY);}catch{return false;}}

export class GameSession {
 constructor(onState,onError){this.onState=onState;this.onError=onError;this.mode=null;this.world=null;this.playerId=null;this.busy=false;this.lastPoll=0;this.lastSave=0;this.state=null;this.desktop=false;this.bootstrap=fetch('/api/health').then(r=>r.json()).then(async data=>{this.desktop=!!data.desktop;if(this.desktop&&data.saveAvailable&&!hasSave()){const response=await fetch('/api/local-save');if(response.ok){const save=await response.json();this.validateSave(save);localStorage.setItem(SAVE_KEY,JSON.stringify(save));}}}).catch(()=>{});}
 async startSolo(name,classId,resume=false){
  await this.bootstrap;this.mode='offline';let save;
  if(resume){try{save=JSON.parse(localStorage.getItem(SAVE_KEY));}catch{throw new Error('Não foi possível ler sua jornada salva. Exporte uma cópia antes de criar outra.');}if(!save&&this.desktop){try{const response=await fetch('/api/local-save');if(response.ok)save=await response.json();}catch{}}}
  if(save){this.validateSave(save);this.world=save.world;this.playerId=save.playerId;const now=Date.now();this.world.lastTick=now;this.world.players[this.playerId].lastMove=now;this.world.players[this.playerId].lastSeen=now;}
  else{const world=createWorld();world.solo=true;const id='solo-'+actionId();createPlayer(world,id,name,classId);this.world=world;this.playerId=id;}
  this.emit(snapshot(this.world,this.playerId));this.persist();return this.state;
 }
 validateSave(save){
  const reject=()=>{throw new Error('Esse arquivo não contém uma jornada de Éridan compatível.');};
  if(save?.format!=='eridan-save'||save.version!==1||save?.world?.schema!==1||typeof save.playerId!=='string'||!Object.hasOwn(save.world.players||{},save.playerId))reject();
  const w=save.world,p=w.players[save.playerId];
  if(!Object.hasOwn(CLASSES,p.classId)||!Number.isInteger(p.level)||p.level<1||p.level>80||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.hp)||!Number.isFinite(p.mana)||!Number.isFinite(w.seq)||!Number.isFinite(w.seed)||!Number.isFinite(w.revision)||typeof p.name!=='string')reject();
  for(const key of ['monsters','nodes','guilds','players','parties','instances','duels','convoys','votes','season'])if(!w[key]||typeof w[key]!=='object'||Array.isArray(w[key]))reject();
  for(const key of ['listings','offers','events','towers'])if(!Array.isArray(w[key]))reject();
  for(const key of ['skills','processed','messages','contracts','discovered','towers','shards','lore','operationWins'])if(!Array.isArray(p[key]))reject();
  for(const key of ['attributes','inventory','resources','equipment','cooldowns','effects','stats','campaign'])if(!p[key]||typeof p[key]!=='object')reject();
  if(p.promotion&&!CLASSES[p.classId].promotions.some(v=>v.id===p.promotion))reject();
  if(!Array.isArray(p.campaign.completed)||!p.campaign.progress||!Number.isInteger(p.campaign.index))reject();
  for(const value of Object.values(p.attributes))if(!Number.isFinite(value))reject();
  // Imported local saves always stay in a solo world; online state is authoritative.
  w.solo=true;
 }

 async online(operation,input){const response=await fetch('/api/game?action='+operation,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível entrar no mundo.');this.mode='online';this.world=null;this.playerId=data.player.id;this.emit(data);return data;}
 emit(state){if(this.mode==='online'&&this.state&&state.player.id===this.state.player.id&&state.revision<this.state.revision)return;this.state=state;this.onState(state);}
 async action(type,args={},silent=false){
  if(!this.mode)return false;if(this.mode==='online'&&this.busy&&type==='move')return false;
  try{
   if(this.mode==='offline'){performAction(this.world,this.playerId,{id:actionId(),type,args});this.emit(snapshot(this.world,this.playerId));return true;}
   if(this.busy&&type==='heartbeat')return false;
   const response=await fetch('/api/game?action=action',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:{id:actionId(),type,args}})});const data=await response.json();if(!response.ok)throw new Error(data.error||'A sincronização falhou.');this.emit(data);return true;
  }catch(error){if(!silent)this.onError(error.message);return false;}
 }
 async update(now=Date.now()){
  if(!this.mode)return;
  if(this.mode==='offline'){if(now-this.lastPoll>130){this.lastPoll=now;performAction(this.world,this.playerId,{type:'heartbeat'},now);this.emit(snapshot(this.world,this.playerId,now));}if(now-this.lastSave>5000){this.lastSave=now;this.persist();}return;}
  if(this.busy||now-this.lastPoll<400)return;this.lastPoll=now;this.busy=true;
  try{const response=await fetch('/api/game?action=state',{credentials:'same-origin',cache:'no-store'});const state=await response.json();if(!response.ok)throw new Error(state.error);this.emit(state);}catch(error){if(now-(this.lastNetworkError||0)>5000){this.lastNetworkError=now;this.onError(error.message||'O mundo está sem conexão. Tentando reconectar.');}}finally{this.busy=false;}
 }
 saveData(){return {format:'eridan-save',version:1,savedAt:new Date().toISOString(),playerId:this.playerId,world:this.world};}
 persist(){if(this.mode!=='offline'||!this.world)return;const data=JSON.stringify(this.saveData());try{localStorage.setItem(SAVE_KEY,data);}catch{this.onError('Seu dispositivo não conseguiu salvar. Exporte uma cópia da jornada.');}if(this.desktop)fetch('/api/local-save',{method:'POST',headers:{'Content-Type':'application/json'},body:data}).catch(()=>{});}
 async importData(save){this.validateSave(save);this.mode='offline';this.world=save.world;this.playerId=save.playerId;this.world.lastTick=Date.now();this.world.players[this.playerId].lastMove=Date.now();this.world.players[this.playerId].lastSeen=Date.now();this.emit(snapshot(this.world,this.playerId));this.persist();}
 stop(){this.persist();this.mode=null;}
}
