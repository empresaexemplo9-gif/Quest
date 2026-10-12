import {GameSession,hasSave} from './session.js';
import {Renderer} from './isometric.js';
import {GameUI} from './ui.js';
import {distance} from './core.js';

const $=id=>document.getElementById(id);
class Game {
 constructor(){
  this.renderer=new Renderer($('world'),$('minimap'));this.ui=new GameUI(this);this.session=new GameSession(state=>{this.state=state;this.ui.update(state);this.processEvents(state);},message=>this.ui.toast(message,true));this.keys=new Set();this.playing=false;this.lastMove=0;this.lastAttack=0;this.sound=false;this.seenEvents=new Set();this.bind();$('continue-game').hidden=!hasSave();this.session.bootstrap.then(()=>$('continue-game').hidden=!hasSave());this.frame();
 }
 async newGame(name,classId){
  await this.session.bootstrap;
  if(hasSave()){this.ui.open('newConfirm');const body=$('modal-body');body.innerHTML='<p>Uma jornada solo já está salva neste dispositivo. Você pode continuar ou exportar uma cópia antes de começar novamente.</p><div class="dialogue-actions"><button class="gold-button" id="confirm-new">Começar uma nova jornada</button><button class="outline-button" id="keep-save">Continuar jornada salva</button></div>';$('confirm-new').onclick=()=>this.startSolo(name,classId,false);$('keep-save').onclick=()=>this.continueGame();return;}
  await this.startSolo(name,classId,false);
 }
 async startSolo(name,classId,resume){$('loading').hidden=false;try{await this.session.startSolo(name,classId,resume);this.enterGame();if(!resume)this.ui.toast('Bem-vindo ao Abrigo 77. G para conversar com Mara Voss.');}catch(error){this.ui.toast(error.message,true);}finally{$('loading').hidden=true;}}
 async continueGame(){await this.startSolo('',null,true);}
 enterGame(){this.playing=true;this.destination=null;this.autoAttack=false;this.keys.clear();this.renderer.reset();this.ui.setPlaying(true);this.ui.update(this.state);}
 async online(data,classId,name){$('loading').hidden=false;try{await this.session.online(data.operation,{username:data.username,password:data.password,name,classId});this.enterGame();return true;}catch(error){this.ui.toast(error.message,true);return false;}finally{$('loading').hidden=true;}}
 async changePassword(data){try{const response=await fetch('/api/game?action=changePassword',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw new Error(result.error);this.session.emit(result);this.ui.toast('Senha alterada. As outras sessões foram encerradas.');return true;}catch(error){this.ui.toast(error.message,true);return false;}}
 async onlineStatus(){try{const response=await fetch('/api/health',{cache:'no-store'});const result=await response.json();return response.ok&&result.online;}catch{return false;}}
 async action(type,args={},silent=false){if(!this.playing&&this.session.mode===null)return false;return this.session.action(type,args,silent);}
 async mainMenu(){this.session.stop();this.playing=false;this.state=null;this.keys.clear();this.ui.setPlaying(false);$('continue-game').hidden=!hasSave();}
 attack(){if(!this.playing)return;this.action('attack',{targetId:this.ui.targetId},true);}
 bind(){
  addEventListener('keydown',event=>{
   const typing=['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);if(event.key==='Escape'){this.ui.close();document.activeElement?.blur();return;}if(typing)return;
   if(event.key==='Tab'&&this.playing){event.preventDefault();const targets=this.state.monsters.slice().sort((a,b)=>distance(a,this.state.player)-distance(b,this.state.player));if(targets.length){const index=targets.findIndex(v=>v.id===this.ui.targetId);this.ui.targetId=targets[(index+1)%targets.length].id;}return;}
   if(this.ui.panel)return;if(!this.playing)return;
   const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)){event.preventDefault();this.keys.add(key);this.destination=null;}
   if(event.repeat)return;const panels={i:'inventory',k:'skills',b:'guild',n:'social',j:'quests',l:'codex',m:'map',c:'character',o:'operations'};if(panels[key]){this.ui.open(panels[key]);this.keys.clear();}
   if(key==='g')this.ui.interact();if(['q','e','r','f'].includes(key))this.action('skill',{slot:['q','e','r','f'].indexOf(key),targetId:this.ui.targetId});if(key==='1'||key==='2')this.action('consume',{itemId:key==='1'?'potion':'focus'});if(key==='v')this.action('mount');if(key==='enter'){$('chat-input').focus();event.preventDefault();}
  });
  addEventListener('keyup',event=>this.keys.delete(event.key.toLowerCase()));addEventListener('blur',()=>{this.keys.clear();this.autoAttack=false;});
  $('world').addEventListener('pointerdown',event=>{
   if(!this.playing||this.ui.panel)return;const position=this.renderer.world(event.clientX,event.clientY),target=[...this.state.monsters,...this.state.players].filter(m=>{const p=this.renderer.screen(m),scale=m.boss?1.8:1;return Math.abs(p.x-event.clientX)<38*scale*this.renderer.zoom&&event.clientY>p.y-105*scale*this.renderer.zoom&&event.clientY<p.y+12*this.renderer.zoom;}).sort((a,b)=>distance(a,position)-distance(b,position))[0];
   if(target){this.ui.targetId=target.id;this.autoAttack=true;this.destination=null;this.attack();}else{this.destination=position;this.autoAttack=false;}
  });
  document.querySelectorAll('[data-direction]').forEach(button=>{const key={up:'w',down:'s',left:'a',right:'d'}[button.dataset.direction];button.onpointerdown=event=>{event.preventDefault();button.setPointerCapture(event.pointerId);this.keys.add(key);this.destination=null;};button.onpointerup=()=>this.keys.delete(key);button.onpointercancel=()=>this.keys.delete(key);button.onlostpointercapture=()=>this.keys.delete(key);});
  $('touch-attack').onpointerdown=event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);this.keys.add(' ');};$('touch-attack').onpointerup=()=>this.keys.delete(' ');$('touch-attack').onpointercancel=()=>this.keys.delete(' ');$('touch-attack').onlostpointercapture=()=>this.keys.delete(' ');
  addEventListener('beforeunload',()=>this.session.persist());document.addEventListener('visibilitychange',()=>{if(document.hidden){this.keys.clear();this.session.persist();}});
 }
 frame(time=performance.now()){
  requestAnimationFrame(t=>this.frame(t));this.renderer.draw(this.playing?this.state:null,this.ui.targetId,time);
  if(!this.playing||!this.state)return;this.session.update();if(this.ui.panel||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  let dx=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0),dy=(this.keys.has('s')||this.keys.has('arrowdown')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')?1:0);
  if(dx||dy){const vector=this.renderer.direction(dx,dy);dx=vector.x;dy=vector.y;}
  if(this.autoAttack){const target=this.state.monsters.find(m=>m.id===this.ui.targetId)||this.state.players.find(m=>m.id===this.ui.targetId);if(target){if(distance(target,this.state.player)>this.state.stats.range*.9){dx=target.x-this.state.player.x;dy=target.y-this.state.player.y;}}else this.autoAttack=false;}
  if(this.destination){if(distance(this.destination,this.state.player)<10)this.destination=null;else{dx=this.destination.x-this.state.player.x;dy=this.destination.y-this.state.player.y;}}
  if((dx||dy)&&time-this.lastMove>95){this.lastMove=time;this.action('move',{dx,dy},true);}
  if((this.keys.has(' ')||this.autoAttack)&&time-this.lastAttack>650){this.lastAttack=time;this.attack();}
 }
 processEvents(state){for(const event of state.events){if(this.seenEvents.has(event.id))continue;this.seenEvents.add(event.id);if(event.type==='level'){this.ui.toast('Seu Éter despertou: nível '+event.level+'.');this.beep(640,.15);}if(event.type==='attack'||event.type==='skill')this.beep(event.classId==='umbra'?160:320,.055);if(event.type==='collect')this.beep(720,.08);if(event.type==='chat')this.ui.addLog(event.sender+': '+event.text);}if(this.seenEvents.size>400)this.seenEvents=new Set([...this.seenEvents].slice(-200));}
 toggleSound(){this.sound=!this.sound;$('sound-toggle').textContent=this.sound?'♫':'♪';$('sound-toggle').setAttribute('aria-label',this.sound?'Desativar som':'Ativar som');if(this.sound){this.audio??=new (window.AudioContext||window.webkitAudioContext)();this.audio.resume();this.beep(440,.15);}this.ui.toast(this.sound?'Sons de Éridan ativados.':'Sons silenciados.');}
 beep(frequency,duration){if(!this.sound||!this.audio)return;const oscillator=this.audio.createOscillator(),gain=this.audio.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.035,this.audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,this.audio.currentTime+duration);oscillator.connect(gain);gain.connect(this.audio.destination);oscillator.start();oscillator.stop(this.audio.currentTime+duration);}
 downloadSave(){if(this.session.mode!=='offline')return;const blob=new Blob([JSON.stringify(this.session.saveData())],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='eridan-'+this.state.player.name+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
 importSave(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>2*1024*1024)throw new Error('Arquivo grande demais.');await this.session.importData(JSON.parse(await file.text()));this.enterGame();this.ui.toast('Jornada recuperada.');}catch(error){this.ui.toast(error.message,true);}};input.click();}
}

const game=new Game();
window.addEventListener('error',()=>{document.getElementById('loading').hidden=true;});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
