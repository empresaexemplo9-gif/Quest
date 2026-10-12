import {REGIONS,CLASSES,NPCS,WORLD} from './content.js';
import {terrain,seeded,hash,regionAt,clamp} from './core.js';
import {project,unproject} from './projection.js';

const SPRITES={warrior:0,archer:1,tank:2,lumen:3,umbra:4,mara:5,workshop:11,tobias:6,nyx:7,kaelith:8,helios:9,orin:10,engineer:11,'thalassa-keeper':11};
const PALETTES=['#344541','#759b8d','#c9b695','#a99e89','#729078','#6d9eb3','#a298b4','#b6b6a5'];
function polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function line(ctx,a,b,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.lineWidth=1;}
const colorBlend=(a,b,weight)=>{const numbers=c=>c.slice(1).match(/../g).map(n=>parseInt(n,16)),x=numbers(a),y=numbers(b);return '#'+x.map((n,i)=>Math.round(n*(1-weight)+y[i]*weight).toString(16).padStart(2,'0')).join('');};

export class Renderer {
 constructor(canvas,minimap) {
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.minimap=minimap;this.mini=minimap.getContext('2d');this.camera={x:450,y:480};this.zoom=1;this.effects=[];this.seen=new Set();this.moving=new Map();this.props=REGIONS.map(r=>terrain(r));
  this.city=new Image();this.city.src='/art/abrigo77.png';this.freeCity=new Image();this.freeCity.src='/art/cidade-livre.png';this.regionArt=new Image();this.regionArt.src='/art/regions.png';this.sprites=new Image();this.sprites.src='/art/characters.png';
  this.resize();addEventListener('resize',()=>this.resize());
 }
 resize(){this.width=innerWidth;this.height=innerHeight;const ratio=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*ratio);this.canvas.height=Math.round(this.height*ratio);this.ctx.setTransform(ratio,0,0,ratio,0,0);this.zoom=this.width<650?.82:1;}
 reset(){this.effects=[];this.seen.clear();this.camera={x:385,y:490};}
 screen(position){const p=project(position),c=project(this.camera);return {x:(p.x-c.x)*this.zoom+this.width/2,y:(p.y-c.y)*this.zoom+this.height/2};}
 world(x,y){const c=project(this.camera);return unproject({x:(x-this.width/2)/this.zoom+c.x,y:(y-this.height/2)/this.zoom+c.y});}
 direction(dx,dy){return unproject({x:dx,y:dy});}
 draw(state,targetId,time=performance.now()) {
  const ctx=this.ctx;
  if(state){this.camera.x+=(state.player.x-this.camera.x)*.15;this.camera.y+=(state.player.y-this.camera.y)*.15;for(const event of state.events){if(this.seen.has(event.id))continue;this.seen.add(event.id);this.effects.push({...event,born:time});}if(this.seen.size>400)this.seen=new Set([...this.seen].slice(-200));}
  else{this.camera.x=450+Math.sin(time/18000)*18;this.camera.y=440+Math.cos(time/22000)*12;}
  ctx.clearRect(0,0,this.width,this.height);ctx.fillStyle='#b6b09b';ctx.fillRect(0,0,this.width,this.height);ctx.save();const camera=project(this.camera);ctx.translate(this.width/2,this.height/2);ctx.scale(this.zoom,this.zoom);ctx.translate(-camera.x,-camera.y);
  const corners=[[0,0],[this.width,0],[this.width,this.height],[0,this.height]].map(([x,y])=>this.world(x,y));
  const bounds={left:Math.min(...corners.map(p=>p.x))-220,right:Math.max(...corners.map(p=>p.x))+220,top:Math.min(...corners.map(p=>p.y))-220,bottom:Math.max(...corners.map(p=>p.y))+220};
  this.ground(ctx,bounds,time,state);
  const regions=REGIONS.filter(r=>r.x<bounds.right&&r.x+2400>bounds.left&&r.y<bounds.bottom&&r.y+1800>bounds.top);
  for(const region of regions)this.cityScene(ctx,region,time);
  const objects=[];
  for(const region of regions)for(const prop of this.props[region.index]){
   // City architecture has its own collision polygons and leaves the plaza clear.
   if(Math.hypot(prop.x-region.x-450,prop.y-region.y-440)<670)continue;
   if(prop.x>bounds.left&&prop.x<bounds.right&&prop.y>bounds.top&&prop.y<bounds.bottom)objects.push({depth:project(prop).y,draw:()=>this.prop(ctx,prop,region)});
  }
  for(const region of regions)for(let i=0;i<6;i++){const crowd={id:'ambient-'+region.index+'-'+i,x:region.x+450+[-125,220,30,290,160,-40][i],y:region.y+440+[180,80,230,270,370,300][i]};objects.push({depth:project(crowd).y,draw:()=>this.character(ctx,crowd,[0,1,2,7,10,11][i],time)});}
  for(const tower of state?.towers||[])if(tower.x>bounds.left&&tower.x<bounds.right&&tower.y>bounds.top&&tower.y<bounds.bottom)objects.push({depth:project(tower).y,draw:()=>this.tower(ctx,tower,time)});
  for(const node of state?.nodes||[])if(node.availableAt<=state.time)objects.push({depth:project(node).y,draw:()=>this.resource(ctx,node,time)});
  for(const npc of state?.npcs||NPCS.filter(n=>n.region===0))objects.push({depth:project(npc).y,draw:()=>{this.character(ctx,npc,SPRITES[npc.id]??11,time);const p=project(npc);this.tag(ctx,p.x,p.y-91,npc.name);}});
  for(const monster of state?.monsters||[])objects.push({depth:project(monster).y,draw:()=>this.monster(ctx,monster,targetId===monster.id,time)});
  for(const player of state?.players||[])objects.push({depth:project(player).y,draw:()=>{this.character(ctx,player,SPRITES[player.classId],time);const p=project(player);this.label(ctx,p.x,p.y-95,player.name,player.pvp?'#bd343a':'#233d51',11);}});
  for(const convoy of state?.convoys||[])objects.push({depth:project(convoy).y,draw:()=>this.vehicle(ctx,convoy)});
  for(const front of state?.instance?.fronts||[]){const p=project(front);ellipse(ctx,p.x,p.y,75,38,front.ready?'#85c7b24d':'#dcb6794d');this.tag(ctx,p.x,p.y-20,front.ready?'✓ FRENTE ESTABILIZADA':front.key);}
  if(state?.instance?.support.length){Object.keys(CLASSES).filter(id=>id!==state.player.classId).forEach((role,i)=>{const angle=1.2+i*1.5,p={id:'support-'+role,x:state.player.x+Math.cos(angle)*75,y:state.player.y+Math.sin(angle)*65};objects.push({depth:project(p).y,draw:()=>{this.character(ctx,p,SPRITES[role],time);const q=project(p);this.label(ctx,q.x,q.y-98,CLASSES[role].name+' · NPC','#284964',9);}});});}
  if(state)objects.push({depth:project(state.player).y,draw:()=>{const p=state.player;this.character(ctx,p,SPRITES[p.classId],time,true);const q=project(p);this.health(ctx,q.x,q.y+9,p.hp/state.stats.maxHp,50,'#56b98f');this.label(ctx,q.x,q.y-97,p.name,'#233d51',11);if(p.effects.shield?.until>state.time){ctx.strokeStyle='#88c5ffaa';ctx.beginPath();ctx.ellipse(q.x,q.y-43,32,47,0,0,Math.PI*2);ctx.stroke();}if(p.summon){const angle=time/700,pulse={x:q.x+45+Math.sin(angle)*4,y:q.y-40};ellipse(ctx,pulse.x,pulse.y,12,16,p.classId==='umbra'?'#b793da':'#efdc8b');}}});
  objects.sort((a,b)=>a.depth-b.depth);for(const object of objects)object.draw();this.drawEffects(ctx,time);ctx.restore();this.atmosphere(ctx,state,time);if(state)this.drawMinimap(state);
 }
 ground(ctx,bounds,time,state){
  const size=100;
  for(let y=Math.floor(bounds.top/size)*size;y<bounds.bottom;y+=size)for(let x=Math.floor(bounds.left/size)*size;x<bounds.right;x+=size){
   if(x<0||y<0||x>=WORLD.width||y>=WORLD.height)continue;const region=regionAt(x+50,y+50),random=seeded(hash(x+','+y));const color=colorBlend(PALETTES[region.index],'#dad3b8',random()*.12);
   polygon(ctx,[[x,y],[x+size+1,y],[x+size+1,y+size+1],[x,y+size+1]].map(([x,y])=>project({x,y})),color);
   for(let i=0;i<4;i++){const p=project({x:x+random()*size,y:y+random()*size});line(ctx,{x:p.x-3,y:p.y},{x:p.x+4,y:p.y+1},region.biome==='water'?'#c3e3e344':'#716d5530');}
  }
  for(const region of REGIONS){const a=project({x:region.x,y:region.y+740}),b=project({x:region.x+2400,y:region.y+740});line(ctx,a,b,'#c7bca4',46);line(ctx,a,b,'#eadfca55',32);}
 }
 cityScene(ctx,region,time){
  const p=project({x:region.x+450,y:region.y+440});
  const image=[1,2].includes(region.index)?this.freeCity:this.city;
  if(image.complete&&image.naturalWidth){ctx.save();if(region.index===5)ctx.filter='hue-rotate(130deg) saturate(.7)';else if(region.index===6)ctx.filter='hue-rotate(245deg) saturate(.7)';const atlasIndex={2:0,4:1,5:2,6:3}[region.index];if(atlasIndex!==undefined&&this.regionArt.complete&&this.regionArt.naturalWidth){ctx.filter='none';const w=this.regionArt.naturalWidth/2,h=this.regionArt.naturalHeight/2;ctx.drawImage(this.regionArt,(atlasIndex%2)*w+2,Math.floor(atlasIndex/2)*h+2,w-4,h-4,p.x-768*1.45,p.y-620*1.45,1536*1.45,1024*1.45);}else ctx.drawImage(image,p.x-768*1.45,p.y-620*1.45,1536*1.45,1024*1.45);ctx.restore();}
  else{polygon(ctx,[[-550,-130],[100,-400],[650,-40],[0,340]].map(([x,y])=>({x:p.x+x,y:p.y+y})),'#d7cbb0','#9d927c');}
 }
 character(ctx,character,index,time,self=false){
  const p=project(character),previous=this.moving.get(character.id),moving=previous&&Math.hypot(previous.x-character.x,previous.y-character.y)>.1;
  this.moving.set(character.id,{x:character.x,y:character.y});ellipse(ctx,p.x+3,p.y+2,19,8,'#3f302c44');if(self){ctx.strokeStyle='#68a7d3';ctx.beginPath();ctx.ellipse(p.x,p.y+2,23,11,0,0,Math.PI*2);ctx.stroke();}
  if(character.mounted)this.vehicle(ctx,character);
  const bob=moving?Math.sin(time/85)*2:Math.sin(time/1500+(index||0))*.5;
  if(this.sprites.complete&&this.sprites.naturalWidth){const cellW=this.sprites.naturalWidth/4,cellH=this.sprites.naturalHeight/4;ctx.save();ctx.imageSmoothingEnabled=true;const width=84,height=112;ctx.drawImage(this.sprites,(index%4)*cellW,Math.floor(index/4)*cellH,cellW,cellH,p.x-width/2,p.y-height*.87+bob,width,height);ctx.restore();}
  else{ellipse(ctx,p.x,p.y-55,14,17,'#edc3a5');polygon(ctx,[{x:p.x-15,y:p.y-40},{x:p.x+15,y:p.y-40},{x:p.x+20,y:p.y-9},{x:p.x-20,y:p.y-9}],['#a94c42','#4e785d','#698ab0','#e3ddc4','#8660a5'][index%5]);line(ctx,{x:p.x-9,y:p.y-9},{x:p.x-12,y:p.y},'#534842',8);line(ctx,{x:p.x+9,y:p.y-9},{x:p.x+12,y:p.y},'#534842',8);}
 }
 monster(ctx,monster,selected,time){
  const p=project(monster),scale=monster.boss?1.8:1;ellipse(ctx,p.x+7,p.y+4,22*scale,9*scale,'#40312655');
  if(this.sprites.complete&&this.sprites.naturalWidth){const index=monster.boss&&monster.region===7?8:12+(monster.kind%4),cw=this.sprites.naturalWidth/4,ch=this.sprites.naturalHeight/4;ctx.drawImage(this.sprites,index%4*cw,Math.floor(index/4)*ch,cw,ch,p.x-45*scale,p.y-90*scale+Math.sin(time/400+monster.x)*2,90*scale,105*scale);}
  else{ellipse(ctx,p.x,p.y-18*scale,22*scale,23*scale,REGIONS[monster.region].accent);ellipse(ctx,p.x-7*scale,p.y-22*scale,2*scale,3*scale,'#29292d');ellipse(ctx,p.x+7*scale,p.y-22*scale,2*scale,3*scale,'#29292d');}
  if(selected){ctx.strokeStyle='#cf7a48';ctx.beginPath();ctx.ellipse(p.x,p.y+5,28*scale,13*scale,0,0,Math.PI*2);ctx.stroke();}
  if(selected||monster.boss){this.health(ctx,p.x,p.y-96*scale,monster.hp/monster.maxHp,58*scale,'#c56869');this.label(ctx,p.x,p.y-108*scale,monster.name,'#6e302e',11);}
 }
 resource(ctx,node,time){
  const p=project(node),color={water:'#67adcd',energy:'#dfb951',materials:'#95765c',food:'#7d9a58',ether:'#ad7eca',data:'#6eafba'}[node.resource];ellipse(ctx,p.x,p.y+1,15,7,'#51463c30');
  if(node.resource==='water'){ellipse(ctx,p.x,p.y-2,18,9,'#81c1dc99');ellipse(ctx,p.x,p.y-4,13,5,'#d8f2ff77');}
  else if(node.resource==='food'){for(let i=0;i<4;i++){line(ctx,{x:p.x-8+i*5,y:p.y},{x:p.x-7+i*5,y:p.y-18-i%2*6},'#4e7e39',3);ellipse(ctx,p.x-7+i*5,p.y-20-i%2*6,4,6,'#92ad61');}}
  else{polygon(ctx,[{x:p.x-11,y:p.y},{x:p.x-13,y:p.y-22},{x:p.x,y:p.y-34},{x:p.x+12,y:p.y-18},{x:p.x+10,y:p.y}],color,'#f2e7d9');line(ctx,{x:p.x,y:p.y-31},{x:p.x+3,y:p.y-2},'#ffffff99',2);}
  if(node.id.endsWith('-0')||node.id.endsWith('-1')){ctx.strokeStyle=color+'99';ctx.beginPath();ctx.ellipse(p.x,p.y+2,23,11,0,0,Math.PI*2);ctx.stroke();}
 }
 prop(ctx,prop,region){const p=project(prop),s=prop.size;
  ellipse(ctx,p.x+18,p.y+6,s*.55,s*.22,'#453f3433');
  if(['forest','vale','swamp'].includes(region.biome)||prop.type===0){line(ctx,{x:p.x,y:p.y},{x:p.x,y:p.y-s*.8},'#796247',9);polygon(ctx,[{x:p.x,y:p.y-s*1.65},{x:p.x+s*.7,y:p.y-s*.5},{x:p.x-s*.7,y:p.y-s*.5}],region.index===4?'#48684d':'#698269','#819266');polygon(ctx,[{x:p.x,y:p.y-s*1.32},{x:p.x+s*.8,y:p.y-s*.15},{x:p.x-s*.8,y:p.y-s*.15}],'#55745b','#8a9a6c');}
  else{polygon(ctx,[{x:p.x-s*.5,y:p.y},{x:p.x-s*.65,y:p.y-s*.35},{x:p.x-s*.2,y:p.y-s*.9},{x:p.x+s*.45,y:p.y-s*.7},{x:p.x+s*.65,y:p.y-s*.1}],region.index===2?'#b39677':'#898b81','#c4c2a7');line(ctx,{x:p.x-s*.2,y:p.y-s*.85},{x:p.x+s*.12,y:p.y-s*.23},'#e3d7bd77',3);}}
 tower(ctx,tower,time){const p=project(tower);ellipse(ctx,p.x+20,p.y+10,60,26,'#48413533');polygon(ctx,[{x:p.x-40,y:p.y+5},{x:p.x,y:p.y+25},{x:p.x+45,y:p.y},{x:p.x+32,y:p.y-22},{x:p.x-24,y:p.y-21}],'#a2a9a8','#ebe7d8');polygon(ctx,[{x:p.x-16,y:p.y-13},{x:p.x-18,y:p.y-140},{x:p.x+20,y:p.y-140},{x:p.x+18,y:p.y-12}],'#747e84','#d3d5c8');polygon(ctx,[{x:p.x,y:p.y-188},{x:p.x+23,y:p.y-157},{x:p.x,y:p.y-128},{x:p.x-23,y:p.y-157}],tower.owner?'#5dafdb':'#a4cbcd','#e2f7f0');this.tag(ctx,p.x,p.y-210,'Torre de Sinal');}
 vehicle(ctx,character){const p=project(character);polygon(ctx,[{x:p.x-31,y:p.y-4},{x:p.x-35,y:p.y-27},{x:p.x+12,y:p.y-41},{x:p.x+35,y:p.y-22},{x:p.x+27,y:p.y+3}],'#718c9b','#dce4db');ellipse(ctx,p.x-19,p.y+1,9,10,'#434753');ellipse(ctx,p.x+23,p.y-1,9,10,'#434753');polygon(ctx,[{x:p.x-20,y:p.y-27},{x:p.x+10,y:p.y-35},{x:p.x+22,y:p.y-24},{x:p.x-13,y:p.y-15}],'#aed4e0');}
 health(ctx,x,y,fraction,width,color){ctx.fillStyle='#e7edfa';ctx.fillRect(x-width/2-1,y-1,width+2,7);ctx.fillStyle='#424e65';ctx.fillRect(x-width/2,y,width,5);ctx.fillStyle=color;ctx.fillRect(x-width/2,y,width*clamp(fraction,0,1),5);}
 label(ctx,x,y,text,color,size=11){ctx.font=`600 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#fff7e4cc';ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.lineWidth=1;}
 tag(ctx,x,y,text){ctx.font='600 11px system-ui,sans-serif';const width=ctx.measureText(text).width+22;ctx.fillStyle='#f7f9ffe8';ctx.strokeStyle='#788aa9';ctx.lineWidth=1;ctx.fillRect(x-width/2,y-17,width,24);ctx.strokeRect(x-width/2,y-17,width,24);ctx.fillStyle='#324259';ctx.textAlign='center';ctx.fillText(text,x,y);}
 drawEffects(ctx,time){this.effects=this.effects.filter(event=>time-event.born<750);for(const event of this.effects){const p=project(event),age=(time-event.born)/750;ctx.globalAlpha=1-age;if(event.type==='attack'||event.type==='skill'||event.type==='support'){const target=project({x:event.targetX??event.x,y:event.targetY??event.y});line(ctx,{x:p.x,y:p.y-40},{x:target.x,y:target.y-30},event.classId==='umbra'?'#9f60d0':'#def2ff',event.type==='skill'?7:3);ellipse(ctx,target.x,target.y-30,12+age*24,17+age*30,'#dceaff55');}if(event.type==='damage'||event.type==='heal')this.label(ctx,p.x,p.y-70-age*35,(event.type==='heal'?'+':'−')+event.value,event.type==='heal'?'#248a62':'#a03539',17);if(event.type==='level'||event.type==='collect'||event.type==='mechanic')this.label(ctx,p.x,p.y-70-age*25,event.type==='level'?'NÍVEL '+event.level:event.type==='collect'?'+'+event.value:event.text||'','#446b86',14);ctx.globalAlpha=1;}}
 atmosphere(ctx,state,time){if(!state)return;const night=Math.max(0,Math.cos(state.daylight*Math.PI*2))*.07;ctx.fillStyle=`rgba(40,55,95,${night})`;ctx.fillRect(0,0,this.width,this.height);if(state.weather.id==='acid'||state.weather.id==='eclipse'){ctx.fillStyle=state.weather.id==='acid'?'#52926114':'#7456a31c';ctx.fillRect(0,0,this.width,this.height);}if(state.weather.id!=='clear')for(let i=0;i<22;i++){const x=(i*97+time*.014)%this.width,y=(i*137+time*.012)%this.height;ellipse(ctx,x,y,1,2,'#e8eef055');}}
 drawMinimap(state){const ctx=this.mini,w=this.minimap.width,h=this.minimap.height,r=state.region;ctx.fillStyle='#ecdfbd';ctx.fillRect(0,0,w,h);const p=position=>({x:(position.x-r.x)/2400*w,y:(position.y-r.y)/1800*h});ctx.strokeStyle='#ae9a77';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,h*.41);ctx.lineTo(w,h*.41);ctx.stroke();for(const node of state.nodes){const q=p(node);ellipse(ctx,q.x,q.y,1,1,'#95a773');}for(const npc of state.npcs){const q=p(npc);ellipse(ctx,q.x,q.y,3,3,'#8a6452');}for(const monster of state.monsters){const q=p(monster);ellipse(ctx,q.x,q.y,monster.boss?3:1.5,monster.boss?3:1.5,'#b66762');}const q=p(state.player);ellipse(ctx,q.x,q.y,4,4,'#487cba');ellipse(ctx,q.x,q.y,1.5,1.5,'#ffffff');}
}
