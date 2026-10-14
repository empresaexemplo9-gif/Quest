// Quest touchscreen controls; native packets, native entities and native collision grids.
import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import Camera from 'Renderer/Camera.js';
import Altitude from 'Renderer/Map/Altitude.js';
import PathFinding from 'Utils/PathFinding.js';
import PACKET from 'Network/PacketStructure.js';
import PACKETVER from 'Network/PacketVerManager.js';
import Network from 'Network/NetworkManager.js';
import {touchCapable,stickDirection,nearbyTargets,preserveTargetSlots,adjacentDestination} from './TouchLogic.js';
import cssText from './TouchQuest.css?raw';

const controls=new GUIComponent('MobileUI',cssText);
let preference=null;
try { const saved=localStorage.getItem('quest.touch.enabled'); if(saved==='1'||saved==='0')preference=saved==='1'; } catch {}
function chooseControls(enabled){preference=enabled;try{localStorage.setItem('quest.touch.enabled',enabled?'1':'0');}catch{} enabled?controls.show():controls.hide();}
controls.needFocus=false;
let root,toggle,active=false,timer=null,moveTimer=null,attackTimer=null,selected=null,slots=Array(6).fill(null),analogPointer=null,lastDest=null;
let attackPointer=null;
const holds=new Map();
const directions=[['up','↑','Mover para cima',0,-1],['left','←','Mover para esquerda',-1,0],['right','→','Mover para direita',1,0],['down','↓','Mover para baixo',0,1]];
controls.render=()=>`<section id="quest-touch" aria-label="Controles de toque do Quest"><p id="touch-tip" role="status">Use as setas para andar. Escolha um alvo no círculo e toque em Atacar.</p><div class="controller movement"><p class="controller-label">MOVIMENTO</p><div class="dpad" aria-label="Joystick de movimento">${directions.map(([key,symbol,label])=>`<button class="direction ${key}" data-direction="${key}" aria-label="${label}">${symbol}</button>`).join('')}<div id="stick" role="slider" tabindex="0" aria-label="Controle direcional de movimento" aria-valuemin="0" aria-valuemax="8" aria-valuenow="0"><span id="stick-knob"></span></div></div></div><div class="controller combat"><p class="controller-label">ALVOS PRÓXIMOS</p><div class="target-wheel" role="group" aria-label="Seleção circular de seis alvos">${Array.from({length:6},(_,i)=>`<button class="target target-${i}" data-slot="${i}" aria-label="Alvo ${i+1}: vazio" disabled><span class="target-index">${i+1}</span><span class="target-name">Vazio</span><span class="target-distance"></span></button>`).join('')}<button id="attack" aria-label="Atacar alvo selecionado" disabled><span>⚔</span>ATACAR</button></div><p id="selected-target" aria-live="polite">Nenhum alvo próximo</p></div><div class="touch-tools"><button id="touch-talk">Conversar</button><button id="touch-pickup">Coletar</button><button id="touch-help">Ajuda</button></div></section>`;
function stopEvent(event){event.preventDefault();event.stopPropagation();}
function message(text){if(root)root.querySelector('#touch-tip').textContent=text;}
function canAct(){const player=Session.Entity;return !!(Session.Playing&&player&&player.action!==player.ACTION.DIE&&player.action!==player.ACTION.SIT);}
function packet(type){return new PACKET.CZ[PACKETVER.value>=20180307?type+'2':type]();}
function move(){
 if(!active||!canAct()||!holds.size)return;
 let x=0,y=0;for(const hold of holds.values()){x+=hold[0];y+=hold[1];}
 const player=Session.Entity,direction=stickDirection(x,y,Camera.direction);
 const destination=adjacentDestination(player.position,direction,(dx,dy)=>{
  if(!(Altitude.getCellType(dx,dy)&Altitude.TYPE.WALKABLE))return false;
  const out=[];const count=PathFinding.search(Math.round(player.position[0]),Math.round(player.position[1]),dx,dy,0,out);
  return count>0&&count<=2;
 });
 if(!destination||destination.join(',')===lastDest)return;
 Session.moveAction=null;Session.autoFollow=false;const pkt=packet('REQUEST_MOVE');pkt.dest[0]=destination[0];pkt.dest[1]=destination[1];Network.sendPacket(pkt);lastDest=destination.join(',');
}
function startMovement(){if(!moveTimer){lastDest=null;move();moveTimer=setInterval(move,180);}}
function stopMovement(){clearInterval(moveTimer);moveTimer=null;lastDest=null;const pointers=[...holds.keys()];holds.clear();analogPointer=null;if(root){for(const element of root.querySelectorAll('#stick,.direction'))for(const id of pointers)if(element.hasPointerCapture(id))element.releasePointerCapture(id);root.querySelector('#stick-knob').style.transform='translate(-50%,-50%)';root.querySelector('#stick').setAttribute('aria-valuenow','0');root.querySelectorAll('.direction').forEach(button=>button.classList.remove('pressed'));}}
function stopAttack(){clearInterval(attackTimer);attackTimer=null;const id=attackPointer;attackPointer=null;if(root){const button=root.querySelector('#attack');button.classList.remove('pressed');if(id!==null&&button.hasPointerCapture(id))button.releasePointerCapture(id);}}
function adaptChat(enabled){const chat=UIManager.components.ChatBox;if(!chat?._host)return;chat._host.toggleAttribute('data-quest-touch-chat',enabled);if(enabled&&!chat.getRoot().querySelector('[data-touch-chat-style]')){const style=document.createElement('style');style.dataset.touchChatStyle='';style.textContent=':host([data-quest-touch-chat]){position:fixed!important;top:auto!important;left:12px!important;bottom:calc(245px + env(safe-area-inset-bottom))!important;width:min(350px,calc(100vw - 30px))!important}:host([data-quest-touch-chat]) #chatbox{width:100%!important}:host([data-quest-touch-chat]) .contentwrapper{height:84px!important;max-height:84px!important}@media(max-width:760px){:host([data-quest-touch-chat]){bottom:calc(290px + env(safe-area-inset-bottom))!important;width:260px!important}}@media(max-height:550px){:host([data-quest-touch-chat]){bottom:210px!important}:host([data-quest-touch-chat]) .contentwrapper{height:42px!important}}';chat.getRoot().append(style);}}
function cancelInputs(){stopMovement();stopAttack();Session.moveAction=null;}
function selectTarget(gid){
 const next=EntityManager.get(gid);if(!next||!slots.some(row=>row?.entity.GID===gid))return;
 const previous=EntityManager.getFocusEntity();if(previous&&previous!==next)previous.onFocusEnd();
 selected=gid;Session.moveAction=null;Session.TouchTargeting=true;Session.AutoTargeting=false;next.onFocus();EntityManager.setFocusEntity(next);refreshTargets();
}
function attack(){
 if(!active||!canAct())return;
 refreshTargets();const target=selected&&EntityManager.get(selected),player=Session.Entity;
 if(!target||!slots.some(row=>row?.entity.GID===selected)){message('Escolha um dos alvos no círculo antes de atacar.');return;}
 const pkt=packet('REQUEST_ACT');pkt.action=0;pkt.targetGID=target.GID;
 if(Math.max(Math.abs(player.position[0]-target.position[0]),Math.abs(player.position[1]-target.position[1]))<=(player.attack_range||1)){Network.sendPacket(pkt);return;}
 if(holds.size){message('Aproxime-se do alvo usando o direcional para alcançar o ataque.');return;}
 const out=[],count=PathFinding.search(player.position[0]|0,player.position[1]|0,target.position[0]|0,target.position[1]|0,(player.attack_range||1)+1,out);
 if(!count){message('Esse alvo está atrás de um bloqueio. Aproxime-se por um caminho livre.');return;}
 if(count<2){Network.sendPacket(pkt);return;}
 Session.moveAction=pkt;const walk=packet('REQUEST_MOVE');walk.dest[0]=out[(count-1)*2];walk.dest[1]=out[(count-1)*2+1];Network.sendPacket(walk);
}
function refreshTargets(){
 if(!root||!active)return;const entities=[];EntityManager.forEach(e=>entities.push(e));slots=preserveTargetSlots(slots,nearbyTargets(Session.Entity,entities));
 if(selected&&!slots.some(row=>row?.entity.GID===selected)){selected=null;stopAttack();}
 for(let i=0;i<6;i++){
  const row=slots[i],button=root.querySelector(`[data-slot="${i}"]`),name=row?.entity.display?.name||'Inimigo';button.disabled=!row;button.classList.toggle('selected',!!row&&row.entity.GID===selected);button.setAttribute('aria-pressed',String(!!row&&row.entity.GID===selected));
  button.querySelector('.target-name').textContent=row?name:'Vazio';button.querySelector('.target-distance').textContent=row?Math.round(row.distance)+' células':'';button.setAttribute('aria-label',row?`Alvo ${i+1}: ${name}, ${Math.round(row.distance)} células`:`Alvo ${i+1}: vazio`);
 }
 root.querySelector('#attack').disabled=!selected;const chosen=slots.find(row=>row?.entity.GID===selected);root.querySelector('#selected-target').textContent=chosen?'Selecionado: '+(chosen.entity.display?.name||'Inimigo'):slots.some(Boolean)?'Toque em um alvo para selecionar':'Nenhum alvo próximo';
}
function talk(){const entities=[];EntityManager.forEach(e=>{if(e.objecttype===6&&Session.Entity&&Math.hypot(e.position[0]-Session.Entity.position[0],e.position[1]-Session.Entity.position[1])<=3)entities.push(e);});if(!entities.length){message('Aproxime-se de um personagem da cidade para conversar.');return;}entities.sort((a,b)=>Math.hypot(a.position[0]-Session.Entity.position[0],a.position[1]-Session.Entity.position[1])-Math.hypot(b.position[0]-Session.Entity.position[0],b.position[1]-Session.Entity.position[1]));const pkt=new PACKET.CZ.CONTACTNPC();pkt.NAID=entities[0].GID;pkt.type=1;Network.sendPacket(pkt);}
function pickup(){const entities=[];EntityManager.forEach(e=>{if(e.objecttype===2&&Session.Entity&&Math.hypot(e.position[0]-Session.Entity.position[0],e.position[1]-Session.Entity.position[1])<=2)entities.push(e);});if(!entities.length){message('Aproxime-se de um item no chão para coletar.');return;}entities.sort((a,b)=>a.GID-b.GID);entities[0].onMouseDown();}
function bindButton(button,action){button.addEventListener('pointerdown',event=>{stopEvent(event);action();});button.addEventListener('click',event=>{stopEvent(event);if(event.detail===0)action();});}
controls.init=function(){
 root=this.getRoot();
 const surface=root.querySelector('#quest-touch');for(const event of ['mousedown','mouseup','click','touchstart','touchmove','touchend'])surface.addEventListener(event,e=>{e.stopPropagation();if(event.startsWith('touch'))e.preventDefault();},{passive:false});
 for(const [key,,label,x,y] of directions){const button=root.querySelector(`[data-direction="${key}"]`);button.addEventListener('pointerdown',event=>{stopEvent(event);button.setPointerCapture(event.pointerId);holds.set(event.pointerId,[x,y]);button.classList.add('pressed');startMovement();});const release=event=>{stopEvent(event);holds.delete(event.pointerId);button.classList.remove('pressed');if(!holds.size)stopMovement();};for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);button.addEventListener('click',event=>{stopEvent(event);if(event.detail===0){holds.set('keyboard',[x,y]);lastDest=null;move();holds.delete('keyboard');}});}
 const stick=root.querySelector('#stick');
 function drag(event){if(event.pointerId!==analogPointer)return;stopEvent(event);const rect=stick.getBoundingClientRect(),x=(event.clientX-rect.left-rect.width/2)/(rect.width/2),y=(event.clientY-rect.top-rect.height/2)/(rect.height/2);holds.set(event.pointerId,[Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y))]);const max=25,scale=Math.max(1,Math.hypot(x,y));root.querySelector('#stick-knob').style.transform=`translate(calc(-50% + ${x/scale*max}px),calc(-50% + ${y/scale*max}px))`;stick.setAttribute('aria-valuenow',String(Math.hypot(x,y)<.2?0:Math.round((Math.atan2(y,x)+Math.PI)/(Math.PI/4))+1));}
 stick.addEventListener('pointerdown',event=>{stopEvent(event);analogPointer=event.pointerId;stick.setPointerCapture(event.pointerId);drag(event);startMovement();});stick.addEventListener('pointermove',drag);for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{stopEvent(e);if(e.pointerId===analogPointer)stopMovement();});
 for(let i=0;i<6;i++)bindButton(root.querySelector(`[data-slot="${i}"]`),()=>{if(slots[i])selectTarget(slots[i].entity.GID);});
 const attackButton=root.querySelector('#attack');attackButton.addEventListener('pointerdown',event=>{stopEvent(event);attackPointer=event.pointerId;attackButton.setPointerCapture(event.pointerId);attackButton.classList.add('pressed');attack();clearInterval(attackTimer);attackTimer=setInterval(attack,400);});for(const event of ['pointerup','pointercancel','lostpointercapture'])attackButton.addEventListener(event,event=>{stopEvent(event);stopAttack();});attackButton.addEventListener('click',event=>{stopEvent(event);if(event.detail===0)attack();});
 bindButton(root.querySelector('#touch-talk'),talk);bindButton(root.querySelector('#touch-pickup'),pickup);bindButton(root.querySelector('#touch-help'),()=>message('Segure uma seta ou arraste o direcional para andar. Escolha um dos seis alvos e segure ATACAR. Dois dedos nos controles funcionam juntos.'));
};
controls.onAppend=function(){
 this._host.style.cssText='position:fixed;inset:0;z-index:9000;pointer-events:none';
 if(!toggle){toggle=document.createElement('button');toggle.id='quest-touch-toggle';toggle.type='button';toggle.textContent='Controles de toque';toggle.style.cssText='position:fixed;right:12px;top:86px;z-index:10001;padding:8px 12px;background:#182b25e8;color:#eee7d8;border:1px solid #b4a071;border-radius:5px;font:13px Arial';toggle.addEventListener('click',event=>{stopEvent(event);chooseControls(!active);});for(const event of ['touchstart','mousedown'])toggle.addEventListener(event,e=>e.stopPropagation());document.body.append(toggle);}
 toggle.hidden=false;selected=null;slots=Array(6).fill(null);cancelInputs();
 if(preference??(touchCapable(navigator,matchMedia('(pointer:coarse)').matches)||Session.isTouchDevice))this.show();else this.hide();
};
controls.show=function(){if(!this._host)return false;active=true;this._host.style.display='block';document.body.classList.add('quest-touch-active');adaptChat(true);Session.TouchTargeting=true;toggle?.setAttribute('aria-pressed','true');clearInterval(timer);timer=setInterval(refreshTargets,450);refreshTargets();return false;};
controls.hide=function(){active=false;cancelInputs();clearInterval(timer);timer=null;if(this._host)this._host.style.display='none';document.body.classList.remove('quest-touch-active');adaptChat(false);toggle?.setAttribute('aria-pressed','false');};
controls.onRemove=function(){this.hide();if(toggle)toggle.hidden=true;selected=null;slots=Array(6).fill(null);};
controls.onShortCut=function(key){if(key.cmd==='ATK')attack();else if(key.cmd==='SHOW')this.show();else if(key.cmd==='TOGGLE')chooseControls(!active);};
window.addEventListener('blur',cancelInputs);window.addEventListener('pagehide',cancelInputs);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelInputs();});window.addEventListener('resize',cancelInputs);
export default UIManager.addComponent(controls);
