const $=id=>document.getElementById(id);
const formatBytes=bytes=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(bytes/(bytes>=1e9?1e9:bytes>=1e6?1e6:bytes>=1e3?1e3:1))+' '+(bytes>=1e9?'GB':bytes>=1e6?'MB':bytes>=1e3?'KB':'B');
let catalog=null,folder='',limit=100;
const params=new URLSearchParams(location.search);
folder=params.get('pasta')||'';$('search').value=params.get('busca')||'';
if([...$('category').options].some(o=>o.value===params.get('tipo')))$('category').value=params.get('tipo');
function syncURL(){
 const query=new URLSearchParams();if(folder)query.set('pasta',folder);if($('search').value.trim())query.set('busca',$('search').value.trim());if($('category').value)query.set('tipo',$('category').value);
 history.replaceState(null,'',location.pathname+(query.size?'?'+query:''));
}
function openFolder(name){folder=name;$('search').value='';$('category').value='';limit=100;render();$('explorador').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
function makeElement(type,text,className){const e=document.createElement(type);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function link(text,url){const a=makeElement('a',text);a.href=url;return a;}
async function downloadFile(file,button){
 const original=button.textContent;button.textContent='Baixando…';button.setAttribute('aria-disabled','true');
 try{
  const response=await fetch(file.download);if(!response.ok)throw Error('Download unavailable');const bytes=await response.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==file.bytes||hash!==file.sha256)throw Error('Integrity mismatch');
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));const save=document.createElement('a');save.href=url;save.download=file.path.split('/').at(-1);document.body.append(save);save.click();save.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  button.textContent='Conferido';setTimeout(()=>button.textContent=original,2500);
 }catch{$('files-error').hidden=false;$('files-error').textContent='Não foi possível conferir este download. Tente novamente ou abra o arquivo pelo botão Ver.';button.textContent=original;}
 finally{button.removeAttribute('aria-disabled');}
}
function crumbs(){
 $('breadcrumbs').replaceChildren();const home=makeElement('button','Todos os arquivos');home.addEventListener('click',()=>openFolder(''));$('breadcrumbs').append(home);
 let prefix='';for(const part of folder.split('/').filter(Boolean)){prefix+=part+'/';const target=prefix;$('breadcrumbs').append(makeElement('span','/'));const button=makeElement('button',part);button.addEventListener('click',()=>openFolder(target));$('breadcrumbs').append(button);}
}
function render(){
 if(!catalog)return;
 const query=$('search').value.trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase(),category=$('category').value;
 const filtered=catalog.files.filter(file=>file.path.startsWith(folder)&&(!category||file.category===category)&&(!query||file.path.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes(query)));
 const entries=[];
 if(query||category){for(const file of filtered)entries.push({file,name:file.path.slice(folder.length),folder:false});}
 else{
  const dirs=new Map();for(const file of filtered){const rest=file.path.slice(folder.length),slash=rest.indexOf('/');if(slash>=0){const name=rest.slice(0,slash);if(!dirs.has(name))dirs.set(name,{name,path:folder+name+'/',count:0,bytes:0,folder:true});const row=dirs.get(name);row.count++;row.bytes+=file.bytes;}else entries.push({file,name:rest,folder:false});}
  entries.unshift(...[...dirs.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')));
 }
 if(query||category)entries.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 $('file-list').replaceChildren();
 for(const row of entries.slice(0,limit)){
  const tr=makeElement('tr',undefined,row.folder?'folder':'file');const nameCell=makeElement('td');nameCell.append(makeElement('span',row.folder?'▣':'◇','file-icon'));
  if(row.folder){const button=makeElement('button',row.name,'file-name');button.addEventListener('click',()=>openFolder(row.path));nameCell.append(button,makeElement('span',row.count+' arquivos','file-path'));}
  else{const a=link(row.name,row.file.view);a.className='file-name';nameCell.append(a);if(query||category)nameCell.append(makeElement('span',row.file.path,'file-path'));}
  tr.append(nameCell);const type=makeElement('td');type.append(makeElement('span',row.folder?'Pasta':row.file.category,'category-tag'));tr.append(type,makeElement('td',formatBytes(row.folder?row.bytes:row.file.bytes)));
  const actions=makeElement('td');if(!row.folder){const download=link('Baixar',row.file.download);if(row.file.bytes<=8*1024*1024)download.addEventListener('click',event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();downloadFile(row.file,download);}});actions.append(download,link('Ver',row.file.view));const copy=makeElement('button','Copiar link','secondary');copy.style.display='inline';copy.style.margin='0';copy.addEventListener('click',()=>copyText(row.file.download,copy,'Copiar link'));actions.append(copy);}tr.append(actions);$('file-list').append(tr);
 }
 $('empty').hidden=entries.length!==0;$('load-more').hidden=entries.length<=limit;
 $('file-count').textContent=`${new Intl.NumberFormat('pt-BR').format(filtered.length)} arquivos${folder?' nesta pasta':''}${entries.length>limit?' · mostrando '+limit+' resultados':''}`;
 crumbs();syncURL();
}
async function copyText(value,button,label){try{await navigator.clipboard.writeText(value);button.textContent='Link copiado';setTimeout(()=>button.textContent=label,2200);}catch{button.textContent='Selecione o endereço na barra';}}
$('copy-link').addEventListener('click',()=>copyText(location.href,$('copy-link'),'Copiar link desta pasta'));
$('search').addEventListener('input',()=>{limit=100;render();});$('category').addEventListener('change',()=>{limit=100;render();});
$('reset').addEventListener('click',()=>{folder='';$('search').value='';$('category').value='';limit=100;render();});$('load-more').addEventListener('click',()=>{limit+=100;render();});
document.querySelectorAll('[data-folder]').forEach(button=>button.addEventListener('click',()=>openFolder(button.dataset.folder)));
$('show-parts').addEventListener('click',()=>{const visible=$('full-parts').hidden;$('full-parts').hidden=!visible;$('show-parts').setAttribute('aria-expanded',String(visible));});
async function loadCatalog(){
 try{const response=await fetch('/central/catalogo.json',{cache:'no-cache'});if(!response.ok)throw Error('Unavailable');catalog=await response.json();
  if(catalog.repository!=='empresaexemplo9-gif/Quest'||!/^[a-f0-9]{40}$/.test(catalog.revision))throw Error('Wrong project');
  if(folder&&!catalog.files.some(file=>file.path.startsWith(folder)))folder='';
  $('catalog-revision').textContent=`${catalog.files.length.toLocaleString('pt-BR')} arquivos públicos · revisão ${catalog.revision.slice(0,7)}. Senhas, contas e bancos de jogadores ficam fora deste acervo.`;
  $('source-download').href=`https://github.com/empresaexemplo9-gif/Quest/archive/${catalog.revision}.zip`;
  $('repository-link').href=`https://github.com/empresaexemplo9-gif/Quest/tree/${catalog.revision}`;
  $('world-guide').href=`https://github.com/empresaexemplo9-gif/Quest/blob/${catalog.revision}/docs/mundo-interligado.md`;
  render();
 }catch{$('file-count').textContent='Acervo indisponível no momento.';$('files-error').hidden=false;$('files-error').textContent='Não foi possível carregar a lista. Você pode acessar os arquivos pelo link do repositório.';}
}
async function loadPackages(){
 try{const response=await fetch('/central/pacotes.json',{cache:'no-cache'});if(!response.ok)throw Error('Unavailable');const packages=await response.json();
  const asset=packages.assets.find(a=>a.name==='Quest-Jogador-2.0.4.zip');if(!asset)throw Error('Missing player');
  $('player-download').href=asset.url;$('player-download').textContent='Baixar pacote do jogador';$('player-size').textContent=formatBytes(asset.bytes)+' · versão '+packages.version;
  const light=packages.assets.find(a=>a.name==='Quest-Desenvolvedor-Sem-Dados-Base-2.0.4.zip');if(!light)throw Error('Missing developer');
  $('light-download').href=light.url;$('light-download').textContent='Baixar desenvolvimento';$('light-download').removeAttribute('aria-disabled');$('light-size').textContent=formatBytes(light.bytes)+' · código, editor e servidor';
  $('full-size').textContent=formatBytes(packages.fullDeveloper.bytes)+' · três partes verificadas';$('release-version').textContent='Quest '+packages.version+' · mundo interligado';
  for(const [i,part] of packages.fullDeveloper.parts.entries())$('part-links').append(link('Parte '+(i+1)+' · '+formatBytes(part.bytes),part.url));
 }catch{$('package-error').hidden=false;$('package-error').textContent='Não foi possível carregar os pacotes. Os instaladores continuam disponíveis na página de downloads.';}
}
await Promise.all([loadCatalog(),loadPackages()]);
