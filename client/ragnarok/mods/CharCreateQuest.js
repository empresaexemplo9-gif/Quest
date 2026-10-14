// Quest character creation. GPL-3.0, integrated with roBrowserLegacy's native packets and sprite renderer.
import GUIComponent from 'UI/GUIComponent.js';
import Entity from 'Renderer/Entity/Entity.js';
import SpriteRenderer from 'Renderer/SpriteRenderer.js';
import UIManager from 'UI/UIManager.js';
import KEYS from 'Controls/KeyEventHandler.js';
import Session from 'Engine/SessionStorage.js';
import {encodeOutfit,encodeCreationPlan,OUTFIT_COLORS} from 'Renderer/Entity/OutfitLogic.js';
const classes=[{id:0,name:'Aprendiz',text:'O primeiro passo de toda jornada.'},{id:1,name:'Espadachim',text:'Combate próximo, espadas e resistência.'},{id:2,name:'Mago',text:'Magia de fogo, gelo e relâmpago.'},{id:3,name:'Arqueiro',text:'Precisão e combate à distância.'},{id:6,name:'Gatuno',text:'Agilidade, esquiva e ataques rápidos.'},{id:4,name:'Noviço',text:'Cura, proteção e bênçãos.'},{id:5,name:'Mercador',text:'Negociação, carga e trabalho em equipe.'}];
const css=`:host{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;font:16px Georgia,serif;color:#f3e8d1}*{box-sizing:border-box}.quest-create{height:100%;overflow:auto;background:linear-gradient(transparent 35%,#10151fe8),url('/quest-art/login-pt.png') center top/cover no-repeat;padding:20px;display:flex;flex-direction:column;justify-content:flex-end}.creation-panel{margin:0 auto;max-width:1120px;width:100%;background:#10151ff5;border:1px solid #b49b62;border-radius:12px;padding:20px}.classes{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}.class{padding:12px 6px;border:1px solid #5b6370;background:#1c2330;color:#eee;font:inherit;cursor:pointer}.class[aria-pressed=true]{border-color:#efd291;background:#4a3c27}.fields{display:grid;grid-template-columns:1fr 170px;gap:20px;margin-top:16px}[hidden]{display:none!important}.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:end}label{display:grid;gap:5px}input,select,button{font:inherit;border-radius:6px}input,select{padding:9px;border:1px solid #87909c;background:#17212c;color:#fff}button{padding:10px 14px;cursor:pointer}.make{background:#dfbc70;color:#10151f;border:0}.cancel{background:#28323e;color:#fff;border:1px solid #7e8792}canvas{width:170px;height:170px;image-rendering:pixelated;background:radial-gradient(#42515677,transparent)}h1{margin:0 0 8px;font-size:26px}.description{margin:8px 0;min-height:20px}.error{color:#ffaaa1}.preview{display:grid;justify-items:center}.hint{font-size:14px;color:#d5c7aa}@media(max-width:720px){.classes{grid-template-columns:repeat(3,1fr)}.fields{grid-template-columns:1fr}.preview{display:none}.quest-create{background-position:center top;padding:8px;justify-content:flex-end}.creation-panel{padding:12px}h1{font-size:22px}.controls{gap:8px}input{max-width:100%}}`;
const Component=new GUIComponent('CharCreatev4',css);
const model=new Entity();let ctx=null,accountSex=1,selectedFamily=0,previewFrame=0;
function updateOutfit(){const root=Component.getRoot(),level=Session.QuestGM?Number(root.querySelector('#gm-level').value):10,color=Session.QuestGM?Number(root.querySelector('#gm-clothes').value):0;model.bodypalette=encodeOutfit(selectedFamily,level===275,color);}
Component.setAccountSex=function(sex){accountSex=sex===0?0:1;};
Component.render=()=>`<div class="quest-create"><section class="creation-panel"><h1>Crie seu personagem</h1><p id="start-hint" class="hint">Nível base 10 · Nível de classe 10 · Habilidades iniciais aprendidas</p><div class="classes">${classes.map(c=>`<button type="button" class="class" data-job="${c.id}" aria-pressed="${c.id===0}">${c.name}</button>`).join('')}</div><p class="description">${classes[0].text}</p><div class="fields"><div><div class="controls"><label>Nome<input id="quest-char-name" maxlength="24" autocomplete="off" placeholder="Nome do personagem"></label><label>Aparência<select id="quest-char-sex"><option value="1">Masculina</option><option value="0">Feminina</option></select></label><label>Cabelo<select id="quest-char-hair">${Array.from({length:23},(_,i)=>`<option value="${i+1}">Estilo ${i+1}</option>`).join('')}</select></label><label>Cor do cabelo<select id="quest-char-color">${['Natural','Loiro','Roxo','Castanho','Verde','Azul','Branco','Preto','Vermelho'].map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label></div><div class="controls gm-options" hidden><label>Nível GM<input id="gm-level" type="number" min="1" max="275" step="1" value="10"></label><button type="button" id="gm-maximum">Nível máximo (275)</button><label>Cor do traje<select id="gm-clothes">${OUTFIT_COLORS.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label><p class="hint">No nível 275, o traje épico é aplicado automaticamente. Use @gmquest depois para manter ou trocar a roupa.</p></div><p class="error" role="alert"></p><div class="controls"><button type="button" class="make">Criar personagem</button><button type="button" class="cancel">Voltar</button></div><p class="hint">Você começará na Chama Viva. A prévia mostra o traje animado da classe. Os trajes de referência possuem aparência própria.</p></div><div class="preview"><canvas width="128" height="128" aria-label="Prévia do visual da classe"></canvas><button type="button" class="rotate">Girar prévia</button></div></div></section></div>`;
Component.init=function(){
 const root=this.getRoot();ctx=root.querySelector('canvas').getContext('2d');
 root.querySelectorAll('.class').forEach(button=>button.addEventListener('click',()=>{
  root.querySelectorAll('.class').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  const job=Number(button.dataset.job);selectedFamily=job;model.set({job});updateOutfit();root.querySelector('.description').textContent=classes.find(c=>c.id===job).text;
 }));
 for(const [id,key] of [['quest-char-sex','sex'],['quest-char-hair','head'],['quest-char-color','headpalette']])root.querySelector('#'+id).addEventListener('change',event=>model.set({[key]:Number(event.target.value)}));
 root.querySelector('#gm-level').addEventListener('input',updateOutfit);root.querySelector('#gm-clothes').addEventListener('change',updateOutfit);root.querySelector('#gm-maximum').addEventListener('click',()=>{root.querySelector('#gm-level').value='275';updateOutfit();});
 root.querySelector('.rotate').addEventListener('click',()=>model.set({direction:(model.direction+1)%8}));
 root.querySelector('.cancel').addEventListener('click',()=>Component.onExitRequest());
 root.querySelector('.make').addEventListener('click',()=>{
  const name=root.querySelector('#quest-char-name').value.trim();
  if(!/^[A-Za-z0-9 ]{4,24}$/.test(name)){root.querySelector('.error').textContent='Use de 4 a 24 letras, números ou espaços no nome.';return;}
  root.querySelector('.error').textContent='';
  if(Session.QuestGM&&!root.querySelector('#gm-level').checkValidity()){root.querySelector('.error').textContent='Escolha um nível inteiro de 1 a 275.';return;}
  const job=Session.QuestGM?encodeCreationPlan(selectedFamily,Number(root.querySelector('#gm-level').value),Number(root.querySelector('#gm-clothes').value)):selectedFamily;
  Component.onCharCreationRequest(name,1,1,1,1,1,1,model.head,model.headpalette,job,model.sex);
 });
};
Component.onAppend=function(){
 selectedFamily=0;model.set({job:0,head:1,headpalette:0,sex:accountSex,direction:4,action:0});
 const root=this.getRoot();root.querySelector('#quest-char-name').value='';root.querySelector('.gm-options').hidden=!Session.QuestGM;root.querySelector('#gm-level').value='10';root.querySelector('#gm-clothes').value='0';root.querySelector('#start-hint').textContent=Session.QuestGM?'Conta GM · escolha o nível · habilidades e arsenal liberados':'Nível base 10 · Nível de classe 10 · Habilidades iniciais aprendidas';updateOutfit();
 root.querySelectorAll('.class').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.job==='0')));
 for(const [id,value] of [['quest-char-sex',String(accountSex)],['quest-char-hair','1'],['quest-char-color','0']])root.querySelector('#'+id).value=value;
 root.querySelector('.description').textContent=classes[0].text;root.querySelector('.error').textContent='';
 cancelAnimationFrame(previewFrame);render();root.querySelector('#quest-char-name').focus();
};
Component.onRemove=function(){cancelAnimationFrame(previewFrame);};
Component.onKeyDown=function(event){if(event.which===KEYS.ESCAPE||event.key==='Escape'){event.stopImmediatePropagation();Component.onExitRequest();return false;}return true;};
function render(){if(!ctx)return;SpriteRenderer.bind2DContext(ctx,64,124);ctx.clearRect(0,0,128,128);model.renderEntity();previewFrame=requestAnimationFrame(render);}
Component.onExitRequest=function(){};Component.onCharCreationRequest=function(){};
export default UIManager.addComponent(Component);
