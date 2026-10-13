// Explicit generation only. Back up manual BrowEdit changes before regenerating.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {nativeToolkit} from './lib/native-map.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),data=path.join(root,'content/eridan/data');
const materials=['grass','cobble','concrete','plaster','metal','glass','moss','bark','leaves','rust','dirt','rubble','energy','wood','roof','canvas','sand','stone','water','basalt','floor'];
for(const t of materials)if(!fs.existsSync(path.join(data,'texture/eridan/'+t+'.bmp')))throw Error('Missing material: '+t);
const {bytes,i,f,s,sh,model,write}=nativeToolkit(data,materials,fs,path);
const rand=(x,y=0)=>{let v=Math.imul(x^0x4b45,y^0x9e37);v^=v>>>13;return (v>>>0)/4294967295;};
model('cliff',m=>{
 m.box(0,0,0,43,4,30,'stone');
 for(let k=0;k<4;k++)m.orb((k-1.5)*10,14+rand(k)*6,rand(k,2)*5,14,20+rand(k,3)*9,12,'stone',k);
 m.orb(-12,5,13,9,4,5,'moss');
});
model('dune',m=>{m.orb(0,-3,0,27,16,19,'sand');m.orb(13,0,-3,14,9,13,'sand',2);});
model('cactus',m=>{
 m.beam([0,0,0],[0,23,0],2.5,1.9,'moss',9);
 m.beam([0,10,0],[-8,10,0],1.8,1.8,'moss');m.beam([-8,10,0],[-8,18,0],1.8,1.3,'moss');
 m.beam([0,7,0],[7,7,0],1.7,1.7,'moss');m.beam([7,7,0],[7,14,0],1.7,1.2,'moss');
});
model('rockspire',m=>{m.orb(0,15,0,10,26,9,'basalt',3);m.orb(6,7,2,6,12,6,'stone',1);});
model('bridge',m=>{
 m.box(0,1,0,52,3,31,'wood');
 for(const z of [-15,15]){
  for(const x of [-23,0,23])m.box(x,0,z,2,14,2,'rust');
  m.box(0,11,z,52,1.5,1.5,'metal');
 }
});
model('sign',m=>{m.box(0,0,0,2,17,2,'wood');m.box(0,12,0,14,6,1.7,'metal');m.box(0,14,1,9,1,1,'energy');});
model('bunker',m=>{
 m.box(0,0,0,54,3,42,'stone');m.box(-21,3,0,10,28,40,'concrete');m.box(21,3,0,10,28,40,'concrete');
 m.box(0,28,0,54,6,42,'metal');m.box(0,3,-16,34,26,5,'basalt');m.box(0,27,22,22,2,2,'energy');
 for(const x of [-17,17])m.box(x,3,22,2,23,2,'rust');
 m.orb(-22,24,14,10,7,6,'moss');
});
model('column',m=>{m.box(0,0,0,10,3,10,'stone');m.beam([0,3,0],[0,31,0],3,2.7,'concrete',8);m.box(0,31,0,11,3,11,'stone');});
model('crystal',m=>{m.beam([0,1,0],[0,19,0],5,.05,'energy',5);m.beam([4,0,1],[10,11,3],3,.05,'glass',5);});

const N=160,low=24,high=136,mid=80;
const gate={south:[mid,low],north:[mid,high],west:[low,mid],east:[high,mid]};
const arrival={south:[mid,low+8],north:[mid,high-8],west:[low+8,mid],east:[high-8,mid]};
const regions=[
 {id:'er_estrada',name:'Estrada dos Despertos',biome:'road',levels:'10–15',gates:['north','south','east'],safe:false,description:'A antiga estrada de Helios une Prontera à Chama Viva. Siga os postes de sinal.'},
 {id:'er_mata',name:'Floresta das Antenas',biome:'forest',levels:'10–20',gates:['south','north','east'],description:'Raízes envolvem antenas antigas. A trilha principal leva às ruínas; a vereda leste, aos campos de caça.'},
 {id:'er_cacada',name:'Campos de Caça do Vale',biome:'hunting',levels:'15–30',gates:['west','east'],description:'Clareiras e lagoas abrigam criaturas de Éridan. Ao leste fica a vila dos sobreviventes.'},
 {id:'er_vilav',name:'Vila das Raízes',biome:'village',levels:'Área segura',gates:['west','north','south'],safe:true,description:'Uma comunidade reconstruída entre módulos antigos. Descanse e combine a próxima viagem com seu grupo.'},
 {id:'er_costas',name:'Costa do Sinal Perdido',biome:'coast',levels:'15–30',gates:['west','north','east'],description:'O oceano engoliu parte da ferrovia. Viaje pelas trilhas sobre as falésias, longe da água.'},
 {id:'er_deserto',name:'Deserto de Vidro',biome:'desert',levels:'20–40',gates:['south','north'],description:'Dunas cobriram coletores solares. Os marcos de metal indicam o caminho até Aurea.'},
 {id:'er_aurea',name:'Aurea — Distrito Recuperado',biome:'city',levels:'Área segura',gates:['south','west'],safe:true,description:'O distrito externo da antiga capital volta a receber viajantes. O núcleo central permanece além das muralhas.'},
 {id:'er_ruinas',name:'Ruínas da Rede Helios',biome:'ruins',levels:'25–45',gates:['south','east'],description:'Entre pilares e torres desativadas há uma entrada para os túneis subterrâneos.'},
 {id:'er_mina1',name:'Galerias do Núcleo — Piso 1',biome:'dungeon',levels:'30–50',gates:['south','north'],description:'Uma masmorra compartilhada. Reúna o grupo antes de descer; a escadaria norte leva ao núcleo inferior.'},
 {id:'er_mina2',name:'Galerias do Núcleo — Piso 2',biome:'dungeon',levels:'45–60',gates:['south'],description:'Cristais do Éter crescem entre as máquinas. Volte pela escadaria sul para reencontrar a superfície.'}
];
const connections=[
 ['chama','south','er_estrada','north'],['chama','north','er_mata','south'],['chama','east','er_costas','west'],
 ['chama','west','er_estrada','east'],['er_mata','east','er_cacada','west'],['er_cacada','east','er_vilav','west'],
 ['er_vilav','south','er_costas','north'],['er_vilav','north','er_deserto','south'],['er_deserto','north','er_aurea','south'],
 ['er_mata','north','er_ruinas','south'],['er_ruinas','east','er_aurea','west'],['er_ruinas','stairs','er_mina1','south'],
 ['er_mina1','north','er_mina2','south'],['er_costas','east','er_estrada','coast'],['er_estrada','south','prontera','road']
];
const mobGroups={
 road:[['Poring do caminho',1002,12],['Fabre da estrada',1007,8]],
 forest:[['Mandrágora das raízes',1020,15],['Sapo das lagoas',1012,12],['Fabre da mata',1007,12]],
 hunting:[['Peco Peco do vale',1019,18],['Poporing da clareira',1031,15],['Sapo do vale',1012,10]],
 coast:[['Peco Peco da costa',1019,12],['Poporing da costa',1031,12]],
 desert:[['Peco Peco das dunas',1019,20],['Poporing do oásis',1031,10]],
 ruins:[['Lobo das ruínas',1013,14],['Poporing do Éter',1031,14]],
 dungeon:[['Lobo das galerias',1013,12],['Metaller do núcleo',1058,8]]
};
const routes=[];
const cvGate={south:[48,20],north:[48,82],east:[82,40],west:[14,40]};
const cvArrival={south:[48,26],north:[40,80],east:[76,40],west:[20,40]};
function endpoint(id,side){
 if(id==='chama')return {id,at:cvGate[side],arrival:cvArrival[side]};
 if(id==='prontera')return {id,at:[146,168],arrival:[150,170]};
 if(side==='stairs')return {id,at:[104,105],arrival:[104,97]};
 if(side==='coast')return {id,at:[112,44],arrival:[106,44]};
 return {id,at:gate[side],arrival:arrival[side]};
}
for(const [a,sa,b,sb] of connections){const from=endpoint(a,sa),to=endpoint(b,sb);routes.push({from,to},{from:to,to:from});}
const report=[];
const distance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
for(const region of regions){
 const seed=regions.indexOf(region)+7,props=[],pois=[],lines=[],own=routes.filter(r=>r.from.id===region.id);
 const center=[80,80];
 for(const route of own){const [x,y]=route.from.at;
  if(region.biome==='dungeon')lines.push([[x,y],[x,80],center]);
  else {
   const entry=route.from.arrival;
   const bend=[(entry[0]+80)/2+(x===mid?10*Math.sin(seed):0),(entry[1]+80)/2+(y===mid?9*Math.cos(seed):0)];
   lines.push([[x,y],entry,bend,center]);
  }
 }
 if(region.biome==='hunting')lines.push([[60,80],[56,106],[83,115],[113,103],[105,82]]);
 if(region.biome==='forest')lines.push([[80,80],[55,94],[50,116]]);
 if(region.biome==='desert')lines.push([[80,80],[108,86],[115,110]]);
 if(region.biome==='coast')lines.push([[80,80],[98,60],[115,52]]);
 const road=(x,y)=>lines.some(line=>line.some((p,k)=>k&&distance(x,y,line[k-1],p)<(region.biome==='city'?6:4)));
 const clear=(x,y)=>road(x,y)||Math.hypot(x-80,y-80)<10||own.some(r=>Math.hypot(x-r.from.at[0],y-r.from.at[1])<9)||pois.some(p=>Math.hypot(x-p.at[0],y-p.at[1])<5);
 const place=(model,x,y,w=0,d=0,scale=1,rotation=0,label=model)=>{
  if(w&&[...pois.map(p=>p.at),...own.flatMap(r=>[r.from.at,r.from.arrival])].some(([a,b])=>Math.abs(a-x)<=w/2+2&&Math.abs(b-y)<=d/2+2))return;
  props.push({model,x,y,w,d,scale,rotation,label});
 };
 const pond=(x,y)=>region.biome==='coast'?x>100&&y<42:
  region.biome==='hunting'?((x-43)/12)**2+((y-53)/8)**2<1:
  region.biome==='forest'?((x-116)/10)**2+((y-112)/8)**2<1:false;
 const rooms=(x,y)=>[[80,45,18,22],[80,80,28,18],[80,118,20,22],[112,80,19,12],[45,80,14,15]].some(([cx,cy,w,h])=>Math.abs(x-cx)<w&&Math.abs(y-cy)<h);
 const blocked=(x,y)=>x<20||y<20||x>140||y>140||pond(x,y)||
  (region.biome==='dungeon'&&!rooms(x,y)&&!road(x,y))||
  props.some(p=>p.w&&Math.abs(x-p.x)<=p.w/2&&Math.abs(y-p.y)<=p.d/2);
 const material=(x,y)=>{
  if(pond(x,y))return 'water';
  if(region.biome==='dungeon')return blocked(x,y)?'basalt':'floor';
  if(region.biome==='desert')return road(x,y)?'trail':'sand';
  if(region.biome==='city')return road(x,y)||Math.hypot(x-80,y-80)<20?'cobble':'overgrown';
  if(region.biome==='ruins')return road(x,y)?'cobble':Math.sin(x*.12)*Math.cos(y*.1)>.2?'stone':'overgrown';
  if(region.biome==='coast'&&y<52)return road(x,y)?'trail':'sand';
  return road(x,y)?'trail':Math.sin(x*.12+y*.07)+Math.cos(y*.17-x*.04)>.6?'overgrown':'meadow';
 };
 // Boundary barriers sit beyond the walkable limits. Closed sides get cliffs;
 // roads end in recognizable gates, eight cells away from return arrivals.
 for(const side of ['south','north','west','east'])for(let p=12;p<=148;p+=7){
  const open=region.gates.includes(side)&&Math.abs(p-mid)<12;
  if(open)continue;
  const x=side==='west'?15:side==='east'?145:p,y=side==='south'?15:side==='north'?145:p;
  const model=region.biome==='desert'?'dune':region.biome==='dungeon'?'rockspire':region.safe?'wall':'cliff';
  place(model,x,y,0,0,region.safe?1.4:1.1,side==='west'||side==='east'?90:0,'Limite natural da região');
 }
 for(const r of own){
  const [x,y]=r.from.at,vertical=y===low||y===high;
  const target=r.to.id==='chama'?'Chama Viva':r.to.id==='prontera'?'Prontera':regions.find(p=>p.id===r.to.id).name;
  place('arch',x,y,0,0,.9,vertical?0:90,'Passagem — '+target);
  const sign=[x+(vertical?7:0),y+(vertical?0:7)];
  pois.push({type:'sign',at:sign,title:'Rota para '+target,text:'Siga a passagem para '+target+'. A viagem ocorre no mesmo mundo para todos os jogadores.'});
  place('sign',...sign,0,0,1,vertical?0:90,'Placa de viagem');
 }
 pois.push({type:'guide',at:[80,76],title:'Marco de '+region.name,text:region.description+' Faixa recomendada: '+region.levels+'.'});
 if(region.safe){
  pois.push({type:'rest',at:[74,78],title:'Ponto de descanso',text:'Aqui você pode recuperar HP/SP e salvar seu retorno nesta comunidade.'});
  for(const [x,y,model] of [[55,104,'workshop'],[107,105,'greenhouse'],[109,53,'ruin'],[53,51,'workshop']])place(model,x,y,12,10,1,0,'Construção recuperada');
  place('cistern',80,88,5,5,1);place('tower',80,110,8,8,.7);
  for(const [x,y] of [[69,91],[91,91],[64,67],[97,67]])place('bench',x,y,4,2,1);
  for(const [x,y] of [[66,86],[94,86],[66,57],[93,57]])place('lamp',x,y,1,1,1);
 }else if(region.biome==='ruins'){
  place('bunker',104,114,11,8,1,0,'Entrada das Galerias do Núcleo');
  for(const [x,y] of [[52,55],[112,56],[49,110]])place('ruin',x,y,11,9,1);
  for(const [x,y] of [[67,100],[65,54],[104,76]])if(!clear(x,y))place('column',x,y,2,2,1);
 }else if(region.biome==='dungeon'){
  for(let y=30;y<134;y+=8)for(let x=30;x<134;x+=8){
   if(!rooms(x,y)&&!road(x,y))place('rockspire',x,y,0,0,1.6,rand(x,y)*360,'Parede das galerias');
  }
  for(const [x,y] of [[65,88],[96,88],[70,113],[93,113],[40,84],[113,85]])if(!clear(x,y))place('crystal',x,y,2,2,1);
 }else if(region.biome==='desert'){
  for(const [x,y] of [[46,62],[113,112],[44,114]])place('ruin',x,y,11,9,.85,rand(x,y)*50,'Ruína coberta de areia');
  place('tower_off',115,60,7,7,.65);
 }else if(region.biome==='coast'){
  place('ruin',50,110,11,9,1,0,'Estação costeira desativada');
  place('tower_off',115,60,6,6,.6);place('bridge',95,48,0,0,1);
 }else{place('salvage',56,58,3,3,1);place('ruin',112,54,11,9,.7,0,'Ruína na trilha');}
 // Trees and relics frame the roads rather than leaving empty crossings.
 if(!region.safe&&region.biome!=='dungeon')for(const line of lines)for(let j=1;j<line.length;j++){
  const a=line[j-1],b=line[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(let d=10;d<len-4;d+=13)for(const side of [-1,1]){
   const x=a[0]+(b[0]-a[0])*d/len-(b[1]-a[1])/len*side*10;
   const y=a[1]+(b[1]-a[1])*d/len+(b[0]-a[0])/len*side*10;
   if(clear(x,y)||pond(x,y)||props.some(p=>p.w&&Math.abs(x-p.x)<p.w/2+4&&Math.abs(y-p.y)<p.d/2+4))continue;
   const arid=region.biome==='desert';
   place(arid?'cactus':'tree1',x,y,2,2,arid?1:.8,rand(j,Math.floor(d))*360,'Margem da trilha');
   place(arid?'rubble':'fern',x+2,y-2,0,0,.7);
  }
 }
 // Irregular terrain dressing. The main roads and arrival areas stay wide.
 for(let k=0;k<145;k++){
  const x=7+rand(k,seed)*146,y=7+rand(k+230,seed+5)*146;
  if(clear(x,y)||pond(x,y)||props.some(p=>p.w&&Math.abs(x-p.x)<p.w/2+4&&Math.abs(y-p.y)<p.d/2+4))continue;
  if(region.biome==='dungeon')continue;
  const desert=region.biome==='desert'||(region.biome==='coast'&&y<55);
  const tree=!desert&&k%3===0;
  const model=desert?(k%4===0?'cactus':k%4===1?'dune':'rubble'):tree?['tree','tree1','tree2'][k%3]:k%2?'fern':'shrub';
  place(model,x,y,tree?2:0,tree?2:0,tree?.65+rand(k,6)*.35:.6+rand(k,2)*.4,rand(k)*360,'Vegetação e relevo');
 }
 // Every declared portal, NPC and corridor is validated against these exact GAT cells.
 const cells=[];
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)cells.push(bytes(f(0,0,0,0),i(blocked(x,y)?1:0)));
 write(region.id+'.gat',bytes(Buffer.from('GRAT'),Buffer.from([1,2]),i(N,N),...cells));
 const tex=['meadow','overgrown','trail','cobble','sand','stone','water','basalt','floor'],tiles=[],surfaces=[],lights=[];
 for(let y=0;y<N/2;y++)for(let x=0;x<N/2;x++){
  const gx=x*2,gy=y*2,k=y*N/2+x,light=Buffer.alloc(256);
  const nearest=props.filter(p=>Math.abs(p.x-gx)<14&&Math.abs(p.y-gy)<14);
  for(let py=0;py<8;py++)for(let px=0;px<8;px++){
   const a=gx+px/7*2,b=gy+2-py/7*2;
   let shade=0;
   for(const p of nearest)shade=Math.max(shade,Math.exp(-(((a-p.x-1)/Math.max(2,p.w/2+2))**2+((b-p.y+1)/Math.max(2,p.d/2+2))**2))*.22);
   light[py*8+px]=Math.round(255*(1-shade));
  }
  lights.push(light);tiles.push(bytes(f(0,1,0,1,0,0,1,1),sh(tex.indexOf(material(gx+1,gy+1)),k),Buffer.from([255,255,255,255])));
  surfaces.push(bytes(f(0,0,0,0),i(k,-1,-1)));
 }
 write(region.id+'.gnd',bytes(Buffer.from('GRGN'),Buffer.from([1,7]),i(N/2,N/2),f(10),i(tex.length,80),...tex.map(t=>s('eridan/'+t+'.bmp',80)),i(lights.length,8,8,1),...lights,i(tiles.length),...tiles,...surfaces));
 const objects=props.map(p=>bytes(i(1),s(p.label,40),i(0),f(1),i(0),s('eridan/'+p.model+'.rsm',80),s('',80),f((p.x-N/2)*5,0,(p.y-N/2)*5),f(0,p.rotation,0),f(p.scale,p.scale,p.scale)));
 const quad=bytes(...Array.from({length:1365},()=>f(N*2.5,0,N*2.5,-N*2.5,-150,-N*2.5,N*2.5,50,N*2.5,0,-50,0)));
 write(region.id+'.rsw',bytes(Buffer.from('GRSW'),Buffer.from([2,1]),s('',40),s(region.id+'.gnd',40),s(region.id+'.gat',40),s('',40),f(10000),i(0),f(0,0,0),i(3),i(40,52),f(region.biome==='dungeon'?.5:.86,.81,.71,.56,.58,.53,.72),i(-N*5,N*5,-N*5,N*5),i(objects.length),...objects,quad));
 report.push({...region,width:N,height:N,spawn:center,pois,portals:own.map(r=>r.from.at),arrivals:own.map(r=>r.from.arrival),mobZones:region.safe?[]:[[52,82,12,24],[110,80,12,25]],colliders:props.filter(p=>p.w),objects:props.length});
}
const world={name:'Rotas compartilhadas de Éridan',revision:1,regions:report,routes,shared:true};
fs.writeFileSync(path.join(root,'content/eridan/world.json'),JSON.stringify(world,null,2)+'\n');
// Real native warp scripts. Reconstruction versions remain the same location in the graph.
const out=['// Generated from content/eridan/world.json. Shared maps; no private instances.','function\tscript\tF_EridanRoute\t{','\t.@destination$ = getarg(0);','\tif (.@destination$ == "chama") .@destination$ = callfunc("F_ChamaMap");','\twarp .@destination$,getarg(1),getarg(2);','\treturn;','}'];
let k=0;
for(const route of routes){
 const sources=route.from.id==='chama'?[0,1,2,3].map(k=>'er_chama'+k):[route.from.id];
 for(const source of sources){
  const [x,y]=route.from.at,[tx,ty]=route.to.arrival;
  if(route.to.id==='chama')out.push(`${source},${x},${y},0\tscript\tPassagem#er${k++}\t45,3,3,{\nOnTouch:\n\tcallfunc "F_EridanRoute","chama",${tx},${ty};\n\tend;\n}`);
  else out.push(`${source},${x},${y},0\twarp\tRota#er${k++}\t3,3,${route.to.id},${tx},${ty}`);
 }
}
for(const region of report){
 out.push(`${region.id}\tmapflag\tloadevent`);
 if(region.safe)out.push(`${region.id}\tmapflag\ttown`);
 for(const poi of region.pois){
  const [x,y]=poi.at,body=poi.type==='rest'?`\t.@choice = select("Descansar:Salvar retorno:Sair");\n\tif (.@choice == 3) close;\n\tif (.@choice == 1) { percentheal 100,100; mes "HP e SP recuperados. Boa viagem!"; } else { savepoint "${region.id}",80,76; mes "Retorno salvo nesta comunidade."; }`:`\tmes ${JSON.stringify(poi.text)};`;
  out.push(`${region.id},${x},${y},4\tscript\t${poi.title.slice(0,22)}#er${k++}\t${poi.type==='sign'?111:poi.type==='rest'?'4_F_KAFRA1':'4_M_SAGE_C'},{\n\tmes ${JSON.stringify('['+poi.title+']')};\n${body}\n\tclose;\n}`);
 }
 if(!region.safe)for(const [name,id,count] of mobGroups[region.biome]||mobGroups.road){
  const [x,y,w,h]=region.mobZones[k++%region.mobZones.length];
  out.push(`${region.id},${x},${y},${w},${h}\tmonster\t${name}\t${id},${count},12000,8000`);
 }
}
out.push('-\tscript\tRotasEridan\t-1,{\nOnPCLoadMapEvent:\n\t.@map$ = strcharinfo(3);');
for(const region of report)out.push(`\tif (.@map$ == "${region.id}") { dispbottom ${JSON.stringify(region.name+' — '+region.levels+'. Use as placas e passagens para explorar com seu grupo.')}; end; }`);
out.push('\tend;\n}');
fs.writeFileSync(path.join(root,'rathena/eridan-world.txt'),out.join('\n\n')+'\n');
const names=path.join(root,'content/ragnarok/data/mapnametable.txt');let text=fs.readFileSync(names,'utf8');
for(const r of report){const line=r.id+'.rsw#'+r.name+'#';text=text.replace(new RegExp('^'+r.id+'\\.rsw#[^\\r\\n]*','m'),'');text+='\n'+line;}
fs.writeFileSync(names,text.replace(/\n{3,}/g,'\n\n')+'\n');
console.log(JSON.stringify({maps:report.length,bidirectionalConnections:connections.length,objects:report.reduce((n,r)=>n+r.objects,0),shared:true}));
