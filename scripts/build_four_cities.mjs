// Explicit generation. Preserves all existing Chama/world maps and backs up this expansion.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {nativeToolkit} from './lib/native-map.mjs';
import {writeNativeRegion} from './lib/world-assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'content/eridan/data'),worldFile=path.join(root,'content/eridan/world.json');
const old=JSON.parse(fs.readFileSync(worldFile,'utf8'));
const materials=['grass','cobble','concrete','plaster','metal','glass','moss','bark','leaves','rust','dirt','rubble','energy','wood','roof','canvas','sand','stone','water','basalt','floor','fc_ivory','fc_ruby','fc_azure','fc_bronze','fc_window','fc_steel'];
// Original procedural materials, rather than altering the existing village textures.
for(const [name,base,kind] of [['fc_ivory',[221,231,239],'stone'],['fc_ruby',[166,28,43],'cloth'],['fc_azure',[25,91,168],'cloth'],['fc_bronze',[148,109,51],'metal'],['fc_window',[15,156,212],'glass'],['fc_steel',[61,67,72],'metal']]){
 const size=128,row=size*3,b=Buffer.alloc(54+row*size);b.write('BM');b.writeUInt32LE(b.length,2);b.writeUInt32LE(54,10);b.writeUInt32LE(40,14);b.writeInt32LE(size,18);b.writeInt32LE(size,22);b.writeUInt16LE(1,26);b.writeUInt16LE(24,28);b.writeUInt32LE(row*size,34);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const noise=((Math.imul(x+37,y+83)^Math.imul(x+913,y+51))&31)/31;
  let shade=(noise-.5)*12;
  if(kind==='stone'){if(y%32<2||(x+(Math.floor(y/32)%2)*32)%64<2)shade-=45;}
  if(kind==='cloth')shade+=Math.sin(x*.16+y*.04)*11+Math.sin(y*.7)*2;
  if(kind==='metal'){if(x%64<3||y%64<3)shade-=28;if((x%64-7)**2+(y%64-7)**2<6)shade+=55;}
  if(kind==='glass')shade+=(x%32<2||y%32<2?55:0)+Math.sin((x+y)*.09)*17;
  const at=54+(y*size+x)*3;for(let c=0;c<3;c++)b[at+2-c]=Math.max(0,Math.min(255,base[c]+shade));
 }
 fs.writeFileSync(path.join(data,'texture/eridan/'+name+'.bmp'),b);
}
const {model}=nativeToolkit(data,materials,fs,path);
const N=192,mid=96;
const gates={south:[96,22],north:[96,170],west:[22,86],east:[170,86]};
const arrivals={south:[96,32],north:[96,160],west:[32,86],east:[160,86]};
const cities=[
 {id:'er_rubra',name:'Citadela Rubra',style:'red',theme:'fortress',biome:'city',safe:true,levels:'Área segura',description:'A fortaleza guarda os fragmentos do Sol Antigo. Oficinas, mercado de sucata e jardins resistentes cercam a praça dos guardiões.'},
 {id:'er_celeste',name:'Coroa Celeste',style:'blue',theme:'sky',biome:'city',safe:true,levels:'Área segura',description:'A catedral do Éter mantém as pontes e as cascatas do distrito suspenso. A natureza recuperou seus terraços de pedra clara.'},
 {id:'er_forja',name:'Bastião da Última Forja',style:'red',theme:'forge',biome:'city',safe:true,levels:'Área segura',description:'Uma comunidade industrial sobrevive entre muralhas, guindastes e canais de resfriamento. A última forja reconstrói a Rede Helios.'},
 {id:'er_azul',name:'Jardins de Nova Aurora',style:'blue',theme:'garden',biome:'city',safe:true,levels:'Área segura',description:'O antigo terminal ferroviário tornou-se uma cidade de jardins, canais e cristais. Sua torre alimenta a reconstrução de Éridan.'}
];
const fields=[
 {id:'er_brasa',name:'Vale das Brasas Verdes',style:'red',biome:'hunting',levels:'40–90',description:'Bosques resistentes cresceram entre velhas tubulações. A estrada ao norte leva da Citadela Rubra à Coroa Celeste.',mobs:[['Orc das Brasas',1023,16],['Orc do Bosque',1273,12],['Sentinela da Sucata',1213,10]],bounty:1},
 {id:'er_jardim',name:'Floresta dos Condutores',style:'blue',biome:'forest',levels:'90–150',description:'Árvores envolveram os condutores da cidade suspensa. Siga a estrada e a ponte para alcançar a Última Forja.',mobs:[['Vespa do Éter',1994,16],['Golem do Condutor',2024,10],['Aranha das Raízes',2092,14]],bounty:2},
 {id:'er_escomb',name:'Deserto das Máquinas Vivas',style:'red',biome:'desert',levels:'140–210',description:'Dunas, oásis e carcaças industriais rodeiam a trilha. Criaturas resistentes defendem as máquinas que ainda funcionam.',mobs:[['Louva-a-deus da Forja',2133,14],['Deletério de Vidro',20374,12],['Espectro da Máquina',20938,10]],bounty:3},
 {id:'er_selva',name:'Selva das Marés de Éter',style:'blue',biome:'coast',levels:'200–275',description:'A floresta costeira e seus canais unem Nova Aurora à Citadela Rubra. As clareiras afastadas exigem equipamento e um grupo preparado.',mobs:[['Napeo da Selva',20922,14],['Litus das Marés',20925,12],['Amitera da Rede',20924,12]],bounty:4}
];
const regionDefs=[cities[0],fields[0],cities[1],fields[1],cities[2],fields[2],cities[3],fields[3]];
const ownIds=new Set(regionDefs.map(r=>r.id));
const backup=path.join(root,'.local/ragnarok/map-backups/four-cities-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backup,{recursive:true});fs.copyFileSync(worldFile,path.join(backup,'world.json'));
for(const id of ownIds)for(const ext of ['gat','gnd','rsw']){const p=path.join(data,id+'.'+ext);if(fs.existsSync(p))fs.copyFileSync(p,path.join(backup,id+'.'+ext));}
const oldNpc=path.join(root,'rathena/eridan-cities.txt');if(fs.existsSync(oldNpc))fs.copyFileSync(oldNpc,path.join(backup,'eridan-cities.txt'));
function ring(m,cx,y,cz,r,thickness,material){for(let k=0;k<20;k++){const a=k*Math.PI/10,b=(k+1)*Math.PI/10;m.beam([cx+r*Math.cos(a),y,cz+r*Math.sin(a)],[cx+r*Math.cos(b),y,cz+r*Math.sin(b)],thickness,thickness,material,6);}}
function tower(m,style,x,z,h=70){
 const stone=style==='blue'?'fc_ivory':'fc_steel',trim='fc_bronze',glow=style==='blue'?'fc_window':'fc_ruby';
 m.box(x,0,z,28,5,28,stone);m.beam([x,5,z],[x,h,z],11,8,stone,8);
 for(let y=15;y<h;y+=16){ring(m,x,y,z,11,1.4,trim);for(const dx of [-9,9])m.box(x+dx,y,z,2,10,3,glow);}
 m.beam([x,h,z],[x,h+25,z],10,0,trim,8);m.beam([x,h+20,z],[x,h+34,z],1,1,glow);
}
for(const style of ['red','blue']){
 const wall=style==='blue'?'fc_ivory':'fc_steel',trim='fc_bronze',glow=style==='blue'?'fc_window':'fc_ruby';
 model('fc_'+style+'_keep',m=>{
  m.box(0,0,0,102,5,72,wall);m.box(0,5,0,78,46,52,wall);
  for(const x of [-48,48])tower(m,style,x,0,77);
  tower(m,style,0,-20,110);m.box(0,55,-5,40,7,44,trim);
  // Recessed entrance, repeated windows, buttresses and planted cornices.
  m.box(0,5,27,20,30,2,'metal');m.beam([-10,35,29],[0,48,29],2,2,trim);m.beam([0,48,29],[10,35,29],2,2,trim);
  for(const x of [-31,-22,22,31]){m.box(x,18,27,6,17,2,glow);m.box(x,3,30,3,41,7,trim);}
  ring(m,0,48,29,10,1.6,glow);m.box(0,48,29,2,14,2,glow);m.box(0,48,29,14,2,2,glow);
  if(style==='blue')for(const x of [-30,28]){m.orb(x,49,15,14,4,7,'moss');m.box(x,35,28,2,18,2,'leaves');}
 });
 model('fc_'+style+'_house',m=>{
  m.box(0,0,0,42,3,32,wall);m.box(0,3,0,35,24,27,wall);m.roof(43,34,27,10,style==='blue'?'fc_azure':'fc_ruby');
  m.box(0,3,15,7,14,2,'wood');
  for(const x of [-11,11]){m.box(x,12,15,6,9,2,'fc_window');m.box(x,11,17,9,1,4,trim);}
  for(const x of [-18,18])m.box(x,3,14,2,23,2,trim);
  m.box(18,29,-8,5,15,5,trim);m.orb(-12,27,0,13,3,9,'moss');
 });
 model('fc_'+style+'_stall',m=>{
  for(const x of [-17,17])for(const z of [-10,10])m.box(x,0,z,2,20,2,trim);
  m.box(0,8,0,38,3,22,'wood');m.roof(40,28,20,5,style==='blue'?'fc_azure':'fc_ruby');
  for(let k=0;k<7;k++)m.orb(-13+k*4,12,3,2.2,2,2.5,k%2?'moss':'canvas');
  m.box(-11,0,-12,10,8,8,'wood');m.box(12,0,-12,10,6,8,'wood');
 });
 model('fc_'+style+'_wall',m=>{
  m.box(0,0,0,38,26,8,wall);m.box(0,26,0,40,3,10,trim);
  for(const x of [-17,0,17])m.box(x,28,0,5,6,10,wall);
  m.box(0,9,5,26,2,1,trim);m.box(-17,0,0,5,30,12,trim);
 });
 model('fc_'+style+'_gate',m=>{
  for(const x of [-30,30])tower(m,style,x,0,49);
  m.box(0,48,0,68,7,14,trim);m.box(0,43,8,22,4,2,glow);
 });
 model('fc_'+style+'_banner',m=>{
  m.box(0,0,0,8,3,8,wall);m.beam([0,3,0],[0,38,0],1,1,trim);
  m.beam([-7,34,0],[7,34,0],.8,.8,trim);m.box(0,14,1,13,20,1,glow);
  m.box(0,23,2,1,10,1,'canvas');m.box(0,27,2,7,1,1,'canvas');
 });
 model('fc_'+style+'_lamp',m=>{
  m.box(0,0,0,5,3,5,wall);m.beam([0,3,0],[0,22,0],1,1,trim);
  m.orb(0,23,0,3,4,3,glow);m.beam([0,27,0],[0,30,0],1,0,trim);
 });
 model('fc_'+style+'_fountain',m=>{
  m.beam([0,0,0],[0,4,0],25,25,wall,20);m.beam([0,4,0],[0,5,0],22,22,'water',20);
  ring(m,0,6,0,24,1.8,trim);m.beam([0,5,0],[0,20,0],7,4,wall);
  ring(m,0,21,0,9,1.2,glow);m.beam([0,20,0],[0,39,0],5,.1,glow,6);
  for(let k=0;k<8;k++){const a=k*Math.PI/4;m.beam([0,23,0],[18*Math.cos(a),6,18*Math.sin(a)],.5,.7,'water');}
 });
 model('fc_'+style+'_statue',m=>{
  m.beam([0,0,0],[0,8,0],19,19,wall,12);m.beam([0,8,0],[0,13,0],12,12,trim,12);
  for(const x of [-4,4])m.beam([x,13,0],[x,31,0],3,4,'metal');
  m.box(0,30,0,15,19,9,'metal');m.orb(0,53,0,4,5,4,'metal');
  m.beam([-8,47,0],[-16,36,2],3,2,'metal');m.beam([8,47,0],[14,58,0],3,2,'metal');
  m.beam([15,35,0],[15,77,0],1.3,1.3,glow);m.box(0,27,-5,18,25,1,glow);
 });
}
model('fc_planter',m=>{m.box(0,0,0,20,4,12,'plaster');m.orb(0,5,0,10,3,6,'moss');for(const x of [-5,5])m.orb(x,8,0,4,3,4,'leaves');});
model('fc_pipe',m=>{m.beam([-24,10,0],[24,10,0],3,3,'rust',10);for(const x of [-18,18]){m.box(x,0,0,5,8,7,'basalt');ring(m,x,10,0,4,1,'metal');}m.box(0,11,3,4,1,4,'metal');});
model('fc_crane',m=>{m.box(0,0,0,12,4,12,'metal');for(const x of [-4,4])m.beam([x,4,0],[x,58,0],1,1,'rust');m.beam([-20,58,0],[36,58,0],2,2,'rust');m.beam([0,65,0],[36,58,0],1,1,'metal');m.beam([30,58,0],[30,22,0],.4,.4,'metal');m.box(30,18,0,5,4,5,'rust');});
model('fc_forge',m=>{m.box(0,0,0,43,7,35,'basalt');m.box(-15,7,0,10,25,32,'rust');m.box(15,7,0,10,25,32,'rust');m.box(0,28,0,42,8,36,'metal');m.box(0,7,-12,20,19,3,'roof');m.box(-12,35,-9,10,31,10,'rust');m.box(-12,66,-9,12,3,12,'metal');m.orb(0,5,20,8,3,5,'roof');});
model('fc_waterfall',m=>{m.box(0,0,0,28,5,18,'stone');m.box(0,5,-8,24,37,9,'plaster');m.box(0,0,-2,18,39,1,'water');m.box(-12,4,1,4,41,5,'plaster');m.box(12,4,1,4,41,5,'plaster');m.orb(-9,43,-4,10,3,5,'moss');});
model('fc_rail',m=>{m.box(0,0,0,60,3,13,'concrete');for(const z of [-4,4])m.box(0,4,z,60,1,1,'metal');for(let x=-28;x<=28;x+=6)m.box(x,3,0,2,1,12,'wood');for(const z of [-7,7])m.box(0,12,z,60,1,1,'metal');});
model('fc_train',m=>{m.box(0,5,0,50,16,13,'plaster');m.roof(52,15,21,3,'metal');for(let x=-17;x<20;x+=9)m.box(x,12,7,6,6,1,'energy');for(const x of [-18,18])for(const z of [-6,6])m.beam([x,4,z-1],[x,4,z+1],3,3,'metal');});
model('fc_airship',m=>{m.orb(0,20,0,44,12,12,'canvas');ring(m,0,20,0,12,1,'rust');m.box(0,0,0,28,5,11,'wood');for(const x of [-10,10])m.beam([x,5,-4],[x,13,-7],.7,.7,'rust');});
model('fc_canopy',m=>{m.beam([0,0,0],[0,28,0],4,2.5,'bark');for(let k=0;k<4;k++){const a=k*Math.PI/2;m.beam([0,21,0],[10*Math.cos(a),34,10*Math.sin(a)],2,1,'bark');m.orb(9*Math.cos(a),35,9*Math.sin(a),13,9,11,'leaves',k);}m.orb(0,42,0,14,9,12,'leaves');});
model('fc_relic',m=>{m.box(0,0,0,28,5,23,'concrete');m.box(-11,5,0,5,18,20,'rust');m.box(9,5,-6,4,27,10,'metal');m.box(0,22,-9,24,3,4,'metal');m.orb(-6,8,7,11,4,8,'moss');});
const distance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
function endpoint(id,side){return {id,at:gates[side],arrival:arrivals[side]};}
const routes=[];
for(let k=0;k<regionDefs.length;k++){
 const a=endpoint(regionDefs[k].id,'north'),b=endpoint(regionDefs[(k+1)%regionDefs.length].id,'south');routes.push({from:a,to:b},{from:b,to:a});
}
const link={id:'er_aurea',at:[80,64],arrival:[72,64]},rubra=endpoint('er_rubra','west');routes.push({from:link,to:rubra},{from:rubra,to:link});
const link2={id:'er_vilav',at:[80,60],arrival:[72,60]},aurora=endpoint('er_azul','east');routes.push({from:link2,to:aurora},{from:aurora,to:link2});
const report=[];
for(const def of regionDefs){
 const region={...def,width:N,height:N,spawn:[96,86],pois:[],portals:[],arrivals:[],mobZones:[],colliders:[],objects:0,expansion:'four-cities'};
 const props=[],own=routes.filter(r=>r.from.id===def.id),seed=regionDefs.indexOf(def)+17;
 const lines=def.safe?[[[22,86],[170,86]],[[96,22],[96,170]],[[54,40],[54,132],[138,132],[138,40],[54,40]],[[54,48],[138,48]],[[54,126],[138,126]]]:[[[96,22],[96,54],[96,86],[96,128],[96,170]],[[40,86],[96,86],[151,86]],[[48,50],[48,128],[144,128],[144,50],[48,50]]];
 const road=(x,y)=>lines.some(line=>line.some((p,k)=>k&&distance(x,y,line[k-1],p)<(def.safe?6:5)));
 const protectedPoint=(x,y)=>[region.spawn,...region.pois.map(p=>p.at),...own.flatMap(r=>[r.from.at,r.from.arrival])].some(([a,b])=>Math.hypot(x-a,y-b)<8);
 const add=(model,x,y,w=0,d=0,scale=1,rotation=0,label=model)=>props.push({model,x,y,w,d,scale,rotation,label});
 const blue=def.style==='blue',prefix='fc_'+def.style+'_';
 function poi(type,at,title,text){region.pois.push({type,at,title,text});}
 poi('guide',[100,83],'Guia de '+def.name,def.description+' Faixa recomendada: '+def.levels+'. As passagens são compartilhadas por todos os grupos.');
 if(def.safe){
  poi('rest',[89,83],'Descanso e retorno','Recupere HP e SP ou salve esta cidade como ponto de retorno.');
  poi('storage',[107,83],'Armazém de '+def.name,'Guarde seus itens antes da próxima viagem.');
  poi('shop',[87,70],'Mercado de '+def.name,'Suprimentos para explorar Éridan.');
  poi('story',[105,70],'Memórias da Rede',def.description+' Reunindo os quatro núcleos, a Rede Helios poderá voltar a ligar as comunidades.');
  add(prefix+'keep',96,147,26,18,1.25,0,blue?'Catedral do Éter':'Fortaleza da comunidade');
  add(prefix+(blue?'fountain':'statue'),96,105,12,12,1.2,0,'Praça central');
  for(const x of [37,73,119,155])for(const y of [54,116])add(prefix+'house',x,y,10,8,1.1,0,'Casa reconstruída');
  for(const x of [40,73,119,151])add(prefix+'stall',x,36,9,7,1,0,'Banca do mercado');
  for(const x of [66,126])for(const y of [67,106])add('fc_planter',x,y,5,3,1,0,'Jardim comunitário');
  for(const x of [63,129])for(const y of [93,118])add('bench',x,y,5,2,1,0,'Banco da praça');
  for(const x of [86,106])for(const y of [42,58,75,124,137])add(prefix+'lamp',x,y,1,1,1,0,'Iluminação da avenida');
  for(const x of [49,143])for(const y of [65,100,132])add(prefix+'banner',x,y,1,1,1,0,'Estandarte da cidade');
  if(blue){
   for(const x of [24,168])for(const y of [55,114,145])add('fc_waterfall',x,y,7,4,.8,0,'Cascata recuperada');
   for(const x of [35,155])for(const y of [70,99,134])add('fc_canopy',x,y,2,2,.8,0,'Árvore dos terraços');
   if(def.theme==='garden'){
    for(let x=34;x<=155;x+=12)add('fc_rail',x,19,0,0,1,0,'Ferrovia recuperada');
    add('fc_train',132,19,0,0,1.1,0,'Trem de Nova Aurora');
   }
  }else{
   for(const x of [24,168])for(const y of [49,111,143])add('fc_pipe',x,y,2,10,.9,90,'Tubulação industrial');
   add('fc_forge',31,143,11,10,1.2,0,'Oficina da forja');add('fc_crane',155,146,3,3,1.3,0,'Guindaste de recuperação');
   if(def.theme==='forge')add('fc_forge',155,68,10,9,1.1,0,'Forno comunitário');
  }
  add('fc_airship',34,158,0,0,.9,0,'Aeróstato de exploração');
 }else{
  poi('bounty',[87,82],'Patrulha de '+def.name,'Derrote 20 criaturas desta região e retorne para receber experiência adicional. Você pode repetir a patrulha.');
  add(prefix+'stall',109,71,9,7,.8,0,'Acampamento de exploração');
  for(const [x,y] of [[66,61],[125,116],[126,49]])add('fc_relic',x,y,7,6,1.2,0,'Ruína tomada pela natureza');
  if(def.biome==='desert'){add('fc_crane',31,145,3,3,1,0,'Guindaste abandonado');add('fc_forge',151,41,10,8,.9,0,'Forja perdida');}
  region.mobZones=[[38,84,13,22],[150,100,13,24],[74,144,12,10]];
 }
 // Continuous visible perimeter. Gate openings align with the exact native warps.
 for(const side of ['south','north','west','east'])for(let p=9;p<=183;p+=7){
  const x=side==='west'?13:side==='east'?179:p,y=side==='south'?13:side==='north'?179:p;
  if(own.some(r=>Math.hypot(x-r.from.at[0],y-r.from.at[1])<15))continue;
  add(def.safe?prefix+'wall':def.biome==='desert'?'dune':'cliff',x,y,0,0,def.safe?1.05:1.25,side==='west'||side==='east'?90:0,'Limite da região');
 }
 for(const r of own){
  const [x,y]=r.from.at,vertical=y===22||y===170;
  add(prefix+'gate',x,y,0,0,.75,vertical?0:90,'Passagem compartilhada');
  const target=regionDefs.find(q=>q.id===r.to.id)?.name||old.regions.find(q=>q.id===r.to.id).name;
  poi('sign',[x+(vertical?10:0),y+(vertical?0:10)],'Caminho para '+target,'Siga a passagem para '+target+'. Combine a viagem com seu grupo.');
  region.portals.push(r.from.at);region.arrivals.push(r.from.arrival);
 }
 const pond=(x,y)=>def.safe?blue&&x>177:((x-124)/12)**2+((y-145)/8)**2<1||(def.biome==='coast'&&x>164&&y<66);
 for(let k=0;k<(def.safe?100:260);k++){
  // Stable integer hash; no random regeneration drift.
  const rand=n=>{let a=Math.imul(n^seed,0x45d9f3b);a^=a>>>16;return (a>>>0)/4294967295;};
  const x=20+rand(k+1)*151,y=20+rand(k+981)*151;
  if(road(x,y)||protectedPoint(x,y)||pond(x,y)||props.some(p=>p.w&&Math.abs(p.x-x)<p.w/2+5&&Math.abs(p.y-y)<p.d/2+5))continue;
  const arid=def.biome==='desert',tree=k%3===0;
  add(arid?(tree?'cactus':'rubble'):tree?'fc_canopy':k%2?'fern':'shrub',x,y,tree?2:0,tree?2:0,tree?.6+rand(k+2)*.25:.6+rand(k+3)*.5,rand(k+9)*360,arid?'Vegetação do oásis':'Vegetação recuperada');
 }
 const blocked=(x,y)=>x<18||y<18||x>174||y>174||pond(x,y)||props.some(p=>p.w&&Math.abs(x-p.x)<=p.w/2&&Math.abs(y-p.y)<=p.d/2);
 const material=(x,y)=>pond(x,y)?'water':def.safe?(road(x,y)||Math.hypot(x-96,y-96)<25?'cobble':blue?'overgrown':'stone'):road(x,y)?'trail':def.biome==='desert'?(Math.hypot(x-122,y-145)<23?'meadow':'sand'):(Math.sin(x*.19)*Math.cos(y*.11)>.15?'overgrown':'meadow');
 region.colliders=props.filter(p=>p.w);region.objects=props.length;
 writeNativeRegion(data,region,props,blocked,material,blue?[.82,.89,.98,.51,.60,.66,.75]:[.98,.79,.61,.62,.51,.43,.75]);
 report.push(region);
}
const baseRegions=old.regions.filter(r=>!ownIds.has(r.id)).map(r=>({...r,portals:[...r.portals],arrivals:[...r.arrivals],pois:[...r.pois]}));
const baseRoutes=old.routes.filter(r=>!ownIds.has(r.from.id)&&!ownIds.has(r.to.id));
for(const route of routes)if(!ownIds.has(route.from.id)){
 const r=baseRegions.find(r=>r.id===route.from.id);
 r.portals=r.portals.filter(p=>p.toString()!==route.from.at.toString());r.arrivals=r.arrivals.filter(p=>p.toString()!==route.from.arrival.toString());
 r.portals.push(route.from.at);r.arrivals.push(route.from.arrival);
}
fs.writeFileSync(worldFile,JSON.stringify({...old,revision:2,regions:[...baseRegions,...report],routes:[...baseRoutes,...routes]},null,2)+'\n');
const out=['// Original four-city expansion. Public shared native maps, no instances.'];let count=0;
for(const r of routes)out.push(`${r.from.id},${r.from.at[0]},${r.from.at[1]},0\twarp\tRotaFC#${count++}\t3,3,${r.to.id},${r.to.arrival[0]},${r.to.arrival[1]}`);
for(const r of report){
 out.push(`${r.id}\tmapflag\tloadevent`);
 if(r.safe)out.push(`${r.id}\tmapflag\ttown`,`${r.id}\tmapflag\tnobranch`,`${r.id}\tmapflag\tnomemo`);
 for(const p of r.pois){
  const name='CidadeFC#'+count++;
  if(p.type==='shop'){out.push(`${r.id},${p.at[0]},${p.at[1]},4\tshop\t${name}\t4_M_01,501:-1,502:-1,503:-1,504:-1,505:-1,506:-1,507:-1,601:-1,602:-1,1750:-1`);continue;}
  let body=`\tmes ${JSON.stringify(p.text)};\n\tclose;`;
  if(p.type==='storage')body='\tclose2;\n\topenstorage;\n\tend;';
  if(p.type==='rest')body=`\t.@choice=select("Descansar:Salvar retorno:Sair");\n\tif(.@choice==1){percentheal 100,100;mes "HP e SP recuperados.";}\n\tif(.@choice==2){savepoint "${r.id}",96,86;mes "Retorno salvo nesta cidade.";}\n\tclose;`;
  if(p.type==='bounty')body=`\tif(quest_fc_active!=${r.bounty}){mes "Patrulha: derrote 20 criaturas desta região. As derrotas em outras regiões não contam.";if(select("Aceitar patrulha:Sair")==1){quest_fc_active=${r.bounty};quest_fc_kills=0;mes "Patrulha iniciada.";}close;}\n\tmes "Criaturas derrotadas: "+quest_fc_kills+"/20.";\n\tif(quest_fc_kills<20)close;\n\tif(select("Receber experiência e repetir:Sair")==2)close;\n\tgetexp BaseLevel*${r.bounty*100000},JobLevel*${r.bounty*10000};\n\tquest_fc_kills=0;mes "Patrulha concluída. Experiência recebida! Uma nova patrulha começou.";close;`;
  out.push(`${r.id},${p.at[0]},${p.at[1]},4\tscript\t${name}\t${p.type==='sign'?111:p.type==='rest'?'4_F_KAFRA1':'4_M_SAGE_C'},{\n\tmes ${JSON.stringify('['+p.title+']')};\n${body}\n}`);
 }
 if(r.mobs)for(let k=0;k<r.mobs.length;k++){
  const [name,id,n]=r.mobs[k],[x,y,w,h]=r.mobZones[k];out.push(`${r.id},${x},${y},${w},${h}\tmonster\t${name}\t${id},${n},20000,12000,PatrulhasFC::OnKill${r.bounty}`);
 }
}
out.push('-\tscript\tPatrulhasFC\t-1,{');
for(const r of fields)out.push(`OnKill${r.bounty}:\n\tif(quest_fc_active==${r.bounty}&&strcharinfo(3)=="${r.id}"&&quest_fc_kills<20){quest_fc_kills++;if(quest_fc_kills==20)dispbottom "Patrulha concluída! Volte ao acampamento para receber experiência.";}\n\tend;`);
out.push('OnPCLoadMapEvent:');for(const r of report)out.push(`\tif(strcharinfo(3)=="${r.id}"){dispbottom ${JSON.stringify(r.name+' — '+r.levels+'. Siga as placas para viajar com seu grupo.')};end;}`);out.push('\tend;\n}');
fs.writeFileSync(oldNpc,out.join('\n\n')+'\n');
const nameFile=path.join(root,'content/ragnarok/data/mapnametable.txt');let names=fs.readFileSync(nameFile,'utf8');
for(const r of report){names=names.replace(new RegExp('^'+r.id+'\\.rsw#[^\\r\\n]*','gm'),'');names+='\n'+r.id+'.rsw#'+r.name+'#';}
fs.writeFileSync(nameFile,names.replace(/\n{3,}/g,'\n\n')+'\n');
console.log(JSON.stringify({cities:4,huntingMaps:4,sharedConnections:routes.length/2,objects:report.reduce((n,r)=>n+r.objects,0),backup}));
