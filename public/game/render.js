import {REGIONS,CLASSES,WORLD,NPCS} from './content.js';
import {terrain,seeded,hash,regionAt,clamp} from './core.js';

export const icon=(kind,color='#d4b583')=>{
 const shapes={blade:'<path d="m9 24 12-12 2-7 7-3-3 7-12 12M7 21l6 6M6 28l4-4"/>',bow:'<path d="M8 5c19 2 19 20 0 22l6-11-6-11Zm0 11h23m-5-4 5 4-5 4"/>',shield:'<path d="M16 3 27 7v10c0 6-11 12-11 12S5 23 5 17V7l11-4Zm0 5v15m-6-10h12"/>',sun:'<circle cx="16" cy="16" r="6"/><path d="M16 1v5m0 20v5M1 16h5m20 0h5M5 5l4 4m14 14 4 4M5 27l4-4M23 9l4-4"/>',moon:'<path d="M23 4A13 13 0 1 0 28 25C10 27 9 9 23 4Z"/><path d="m23 10 2 3 3 2-3 1-2 3-1-3-3-1 3-2Z"/>',potion:'<path d="M12 3h8v7l7 12c2 5-1 8-6 8H11c-5 0-8-3-6-8l7-12V3Zm-2 17h12M10 3h12"/>',focus:'<path d="m18 2-9 15h8l-3 13 11-18h-8l1-10Z"/>',mount:'<path d="m5 20 4-8h12l7 8M8 12l-2-4m17 4 2-4M5 20h23"/><circle cx="9" cy="23" r="4"/><circle cx="24" cy="23" r="4"/>',book:'<path d="M16 8c-5-4-9-4-13-2v22c5-2 9-2 13 1 4-3 8-3 13-1V6c-4-2-8-2-13 2Zm0 0v21"/>',crystal:'<path d="m16 2 10 10-3 14-7 5-7-5-3-14 10-10Zm0 0v29M6 12h20m-20 0 10 19 10-19"/>'};
 return `<svg viewBox="0 0 32 32" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[kind]||shapes.crystal}</svg>`;
};

const mix=(a,b,f)=>{const rgb=value=>value.replace('#','').match(/.{2}/g).map(v=>parseInt(v,16));const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v*(1-f)+y[i]*f).toString(16).padStart(2,'0')).join('');};
function polygon(ctx,points,fill,stroke=null){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function circle(ctx,x,y,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,Math.PI*2);ctx.fill();}
function glow(ctx,x,y,r,color){const gradient=ctx.createRadialGradient(x,y,1,x,y,r);gradient.addColorStop(0,color);gradient.addColorStop(1,color.slice(0,7)+'00');ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);}
function line(ctx,x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.lineWidth=1;}

export class Renderer {
 constructor(canvas,minimap){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.minimap=minimap;this.mini=minimap.getContext('2d');this.camera={x:1250,y:760};this.width=innerWidth;this.height=innerHeight;this.zoom=1;this.effects=[];this.seen=new Set();this.props=REGIONS.map(r=>terrain(r));this.resize();addEventListener('resize',()=>this.resize());}
 resize(){this.width=innerWidth;this.height=innerHeight;const ratio=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*ratio);this.canvas.height=Math.round(this.height*ratio);this.ctx.setTransform(ratio,0,0,ratio,0,0);this.zoom=this.width<650?.9:1;}
 reset(){this.effects=[];this.seen.clear();this.camera={x:385,y:490};}
 screen(position){return {x:(position.x-this.camera.x)*this.zoom+this.width/2,y:(position.y-this.camera.y)*this.zoom+this.height/2};}
 world(x,y){return {x:(x-this.width/2)/this.zoom+this.camera.x,y:(y-this.height/2)/this.zoom+this.camera.y};}
 draw(state,targetId,time=performance.now()){
  const ctx=this.ctx,playing=!!state;
  if(playing){this.camera.x+=(state.player.x-this.camera.x)*.13;this.camera.y+=(state.player.y-this.camera.y)*.13;for(const e of state.events){if(this.seen.has(e.id))continue;this.seen.add(e.id);this.effects.push({...e,born:time});}if(this.seen.size>400)this.seen=new Set([...this.seen].slice(-200));}
  else{this.camera.x=1260+Math.sin(time/20000)*30;this.camera.y=760+Math.cos(time/20000)*20;}
  ctx.clearRect(0,0,this.width,this.height);ctx.fillStyle='#1d2b2d';ctx.fillRect(0,0,this.width,this.height);ctx.save();ctx.translate(this.width/2,this.height/2);ctx.scale(this.zoom,this.zoom);ctx.translate(-this.camera.x,-this.camera.y);
  const left=this.camera.x-this.width/2/this.zoom-160,right=this.camera.x+this.width/2/this.zoom+160,top=this.camera.y-this.height/2/this.zoom-180,bottom=this.camera.y+this.height/2/this.zoom+180;
  this.ground(ctx,left,right,top,bottom,time,state);
  const visible=REGIONS.filter(r=>r.x<right&&r.x+2400>left&&r.y<bottom&&r.y+1800>top);
  for(const region of visible){this.roads(ctx,region);this.hub(ctx,region,time);this.crater(ctx,region,time);this.tower(ctx,state?.towers.find(t=>t.region===region.index)||{region:region.index,x:region.x+1800,y:region.y+500,owner:null},time);}
  for(const front of state?.instance?.fronts||[]){circle(ctx,front.x,front.y,80,front.ready?'#90bea622':'#d4b58322','#d4b58377');this.label(ctx,front.x,front.y-15,front.ready?'✓ FRENTE ESTABILIZADA':front.key.toUpperCase(),front.ready?'#9dccb5':'#e3cc89',10);this.label(ctx,front.x,front.y+10,'Aproxime-se · menu Operação','#c0c9b8',8);}
  const objects=[];
  for(const region of visible)for(const prop of this.props[region.index])if(prop.x>left&&prop.x<right&&prop.y>top&&prop.y<bottom)objects.push({y:prop.y,draw:()=>this.prop(ctx,prop,region,time)});
  const npcs=state?state.npcs:NPCS.filter(n=>n.region===0);
  for(const npc of npcs)objects.push({y:npc.y,draw:()=>{this.person(ctx,npc,npc.color,'npc',time);this.label(ctx,npc.x,npc.y-52,npc.name,npc.color,9);this.label(ctx,npc.x,npc.y-37,npc.title,'#a8b4ad',6);circle(ctx,npc.x,npc.y-64,3,'#e7cb80');}});
  for(const node of state?.nodes||[])if(node.availableAt<=state.time)objects.push({y:node.y,draw:()=>this.resource(ctx,node,time)});
  for(const monster of state?.monsters||[])objects.push({y:monster.y,draw:()=>this.monster(ctx,monster,monster.id===targetId,time)});
  for(const person of state?.players||[])objects.push({y:person.y,draw:()=>{this.person(ctx,person,CLASSES[person.classId].color,person.classId,time);this.label(ctx,person.x,person.y-45,person.name,person.pvp?'#d99d8f':'#cbd7c6',8);if(person.id===targetId)this.health(ctx,person.x,person.y-56,person.hp/person.maxHp,40,'#c68073');}});
  for(const convoy of state?.convoys||[])objects.push({y:convoy.y,draw:()=>this.vehicle(ctx,convoy,time)});
  if(state?.instance?.support.length){const roles=Object.keys(CLASSES).filter(id=>id!==state.player.classId);roles.forEach((role,i)=>{const angle=1.2+i*1.5,p={x:state.player.x+Math.cos(angle)*55,y:state.player.y+Math.sin(angle)*40};objects.push({y:p.y,draw:()=>{this.person(ctx,p,CLASSES[role].color,role,time);this.label(ctx,p.x,p.y-59,CLASSES[role].name+' NPC','#afc3ae',7);}});});}
  if(state){objects.push({y:state.player.y,draw:()=>{const p=state.player;this.person(ctx,p,CLASSES[p.classId].color,p.classId,time,true);if(p.effects.shield?.until>state.time){ctx.strokeStyle='#cfcda8aa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y-16,28,36,0,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;}if(p.summon){const sx=p.x+38+Math.sin(time/400)*6,sy=p.y-38+Math.cos(time/450)*5;glow(ctx,sx,sy,32,p.classId==='umbra'?'#b5a0df33':'#91cbb333');polygon(ctx,[[sx,sy-8],[sx+12,sy],[sx,sy+8],[sx-12,sy]],p.classId==='umbra'?'#9783b8':'#88aeb5');}}});}
  objects.sort((a,b)=>a.y-b.y);for(const object of objects)object.draw();this.effect(ctx,time);ctx.restore();
  this.atmosphere(ctx,state,time);if(state)this.drawMinimap(state);
 }
 ground(ctx,left,right,top,bottom,time,state){
  const size=96;
  for(let y=Math.floor(top/size)*size;y<bottom;y+=size)for(let x=Math.floor(left/size)*size;x<right;x+=size){if(x<0||y<0||x>=WORLD.width||y>=WORLD.height)continue;const region=regionAt(x+48,y+48),random=seeded(hash(x+','+y));const base=mix(region.color,'#1f2b2b',.46+random()*.09);ctx.fillStyle=base;ctx.fillRect(x,y,size+1,size+1);
   if(region.biome==='water'||region.biome==='swamp'){ctx.fillStyle=region.biome==='water'?'#375967':'#284d46';if(random()<.45){ctx.beginPath();ctx.ellipse(x+40,y+48,50,28,random(),0,Math.PI*2);ctx.fill();for(let k=0;k<4;k++)line(ctx,x+10+k*12,y+43+Math.sin(time/1000+k)*2,x+26+k*12,y+43+Math.sin(time/1000+k)*2,'#89a9a519');}}
   for(let k=0;k<9;k++){const px=x+random()*size,py=y+random()*size;if(region.biome==='desert'){circle(ctx,px,py,random()*2+.3,'#d4bd8f20');}else if(region.biome==='city'){line(ctx,px,py,px+9,py+1,'#acaaa223');}else{line(ctx,px,py,px+random()*5-2,py-3-random()*7,'#a3b28b24');}}
  }
  const legacy=state?.season.ending||state?.season.legacy;if(legacy){ctx.globalAlpha=.06;ctx.fillStyle=legacy==='reconstruction'?'#b8daa4':legacy==='dominion'?'#c98578':'#bca0ed';ctx.fillRect(left,top,right-left,bottom-top);ctx.globalAlpha=1;}
 }
 roads(ctx,r){ctx.strokeStyle='#ad9c7040';ctx.lineWidth=42;ctx.beginPath();ctx.moveTo(r.x,r.y+740);ctx.bezierCurveTo(r.x+600,r.y+710,r.x+1400,r.y+850,r.x+2400,r.y+740);ctx.stroke();ctx.strokeStyle='#c0b18a21';ctx.lineWidth=16;ctx.stroke();ctx.strokeStyle='#989c8025';ctx.lineWidth=32;ctx.beginPath();ctx.moveTo(r.x+450,r.y+440);ctx.lineTo(r.x+620,r.y+630);ctx.lineTo(r.x+800,r.y+740);ctx.lineTo(r.x+1800,r.y+500);ctx.stroke();ctx.lineWidth=1;}
 hub(ctx,r,time){
  const x=r.x+450,y=r.y+440;ctx.fillStyle='#47504a';ctx.beginPath();ctx.ellipse(x+20,y+16,250,184,-.05,0,Math.PI*2);ctx.fill();ctx.fillStyle='#63695844';ctx.beginPath();ctx.ellipse(x,y+25,191,131,0,0,Math.PI*2);ctx.fill();
  for(let i=0;i<18;i++){const angle=i*Math.PI*2/18;const px=x+Math.cos(angle)*242,py=y+Math.sin(angle)*174;line(ctx,px,py-12,px+12,py-10,'#3c4543',12);line(ctx,px,py-13,px+12,py-11,'#7c826b',2);}
  this.building(ctx,x-145,y-125,115,70,'#656c66','ABRIGO 77');this.building(ctx,x+152,y-95,95,62,'#635e50',r.index===0?'OFICINA':'POSTO LIVRE');this.building(ctx,x+12,y-160,93,60,'#585e56','CHAMA VIVA');
  for(const [dx,dy]of [[-70,55],[110,65],[-185,-30]]){ctx.fillStyle='#293536';ctx.fillRect(x+dx-9,y+dy-6,18,12);glow(ctx,x+dx,y+dy-8,70,'#dfb57a22');polygon(ctx,[[x+dx-6,y+dy-5],[x+dx+2,y+dy-22-Math.sin(time/100)*3],[x+dx+7,y+dy-6]],'#d8a461');polygon(ctx,[[x+dx-3,y+dy-5],[x+dx+1,y+dy-15],[x+dx+4,y+dy-6]],'#e8d196');}
  line(ctx,x-28,y-65,x-28,y-130,'#b6ac85',3);polygon(ctx,[[x-26,y-127],[x+8,y-125],[x+6,y-101],[x-26,y-107]],'#9b7753');line(ctx,x-13,y-121,x-13,y-109,'#edc583',2);line(ctx,x-18,y-115,x-8,y-115,'#edc583',2);
 }
 building(ctx,x,y,w,h,color,label){
  ctx.fillStyle='#0b171c44';ctx.beginPath();ctx.ellipse(x+8,y+20,w*.64,h*.57,0,0,Math.PI*2);ctx.fill();polygon(ctx,[[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]],'#343e3d');polygon(ctx,[[x-w/2,y-h/2-20],[x,y-h/2-35],[x+w/2,y-h/2-20],[x+w/2,y+h/2-20],[x-w/2,y+h/2-20]],color,'#87917a55');line(ctx,x-w/2,y-h/2-18,x+w/2,y-h/2-18,'#a1a38b44');ctx.fillStyle='#1c2a2b';ctx.fillRect(x-16,y+h/2-25,30,25);ctx.fillStyle='#a8beac';ctx.fillRect(x-10,y+h/2-24,5,17);ctx.fillStyle='#d9ba7b';ctx.fillRect(x-12,y+h/2-30,25,3);this.label(ctx,x,y-h/2-48,label,'#c4c7ae',6);
  for(let i=0;i<4;i++)line(ctx,x-w/2+12+i*20,y-h/2-19,x-w/2+12+i*20,y+h/2-21,'#9aa08938');
 }
 crater(ctx,r,time){
  const x=r.x+1300,y=r.y+900;const random=seeded(r.index+58);ctx.fillStyle='#12212855';ctx.beginPath();ctx.ellipse(x,y,130,82,-.35,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#aaa37d28';ctx.lineWidth=4;ctx.stroke();ctx.lineWidth=1;const color=r.index===6?'#ad91cf':r.accent;
  for(let i=0;i<8;i++){const angle=random()*Math.PI*2,rad=38+random()*100;line(ctx,x,y,x+Math.cos(angle)*rad,y+Math.sin(angle)*rad*.65,color+'30',1.5);}
  for(let i=0;i<5;i++){const cx=x-60+i*28,cy=y+Math.sin(i)*18,height=25+random()*60;glow(ctx,cx,cy-height*.5,64,color+'22');polygon(ctx,[[cx-12,cy],[cx-10,cy-height*.45],[cx,cy-height],[cx+15,cy-height*.4],[cx+13,cy]],mix(color,'#293c43',.2));polygon(ctx,[[cx,cy-height],[cx+15,cy-height*.4],[cx+13,cy],[cx+3,cy-7]],color+'a0');line(ctx,cx,cy-height+3,cx+3,cy-7,'#f2edd06f');}
  for(let i=0;i<9;i++){const phase=(time/2000+i*.45)%1,px=x+Math.sin(i*3)*90,py=y-phase*140;circle(ctx,px,py,1.1,color+Math.floor((1-phase)*120).toString(16).padStart(2,'0'));}
 }
 tower(ctx,tower,time){
  const {x,y}=tower;ctx.fillStyle='#0b161d55';ctx.beginPath();ctx.ellipse(x+30,y+20,65,35,.3,0,Math.PI*2);ctx.fill();polygon(ctx,[[x-42,y+12],[x,y+25],[x+43,y+9],[x+32,y-20],[x-31,y-23]],'#62675d','#adb09055');polygon(ctx,[[x-19,y],[x-15,y-112],[x+10,y-123],[x+22,y-6]],'#3b4d50','#8c9d8b70');polygon(ctx,[[x+10,y-123],[x+22,y-6],[x+33,y-16],[x+25,y-115]],'#273d43');line(ctx,x-10,y-13,x-8,y-104,'#adbaa266',3);line(ctx,x-3,y-16,x,y-107,tower.owner?'#d5c391':'#89b7b7',2);glow(ctx,x+3,y-124,65,'#ddc89244');circle(ctx,x+3,y-126,6,'#e3d39e');ctx.strokeStyle='#d1c29442';ctx.beginPath();ctx.ellipse(x+3,y-126,23+Math.sin(time/700)*3,7,0,0,Math.PI*2);ctx.stroke();line(ctx,x+3,y-134,x+3,y-158,'#d2c295',2);this.label(ctx,x,y+45,'TORRE DE SINAL','#cbd0b4',7);
 }
 prop(ctx,p,r,time){
  const x=p.x,y=p.y,s=p.size;ctx.fillStyle='#0b181933';ctx.beginPath();ctx.ellipse(x+8,y+5,s*.7,s*.24,.1,0,Math.PI*2);ctx.fill();
  if((r.biome==='forest'||r.biome==='swamp'||r.biome==='scrub')&&p.type<2){line(ctx,x,y,x+Math.sin(time/4000+x)*2,y-s*.9,'#697261',6);line(ctx,x-12,y-s*.65,x+14,y-s*.85,'#a6af861c',12);polygon(ctx,[[x-s*.55,y-s*.55],[x-s*.23,y-s*.95],[x,y-s*1.3],[x+s*.4,y-s*.85],[x+s*.6,y-s*.55]],mix(r.color,'#30493e',.5));polygon(ctx,[[x-s*.5,y-s*.45],[x-s*.1,y-s*.95],[x+s*.35,y-s*.6],[x+s*.55,y-s*.35]],mix(r.color,'#6e8358',.3));if(r.biome==='forest'){circle(ctx,x+3,y-s*.7,2,'#a0d2c4');line(ctx,x,y-5,x,y-s*.6,'#88baa34c',1);}}
  else if(p.type===2){polygon(ctx,[[x-s*.4,y],[x-s*.55,y-s*.25],[x-s*.2,y-s*.6],[x+s*.25,y-s*.6],[x+s*.55,y-s*.2],[x+s*.4,y+4]],mix(r.color,'#839082',.18));polygon(ctx,[[x-s*.2,y-s*.6],[x+s*.25,y-s*.6],[x+s*.55,y-s*.2],[x+3,y-s*.1]],mix(r.color,'#839082',.35));}
  else{this.building(ctx,x,y,s*.85,s*.48,mix(r.color,'#657068',.25),'');ctx.fillStyle='#222d2e';ctx.fillRect(x-s*.2,y-s*.18,s*.35,3);}
 }
 resource(ctx,node,time){
  const {x,y}=node;const color={water:'#88b9c4',energy:'#e2c285',materials:'#b1aea0',food:'#92b188',ether:'#b2a1d6',data:'#8abfb6'}[node.resource];glow(ctx,x,y-8,32,color+'18');
  if(node.resource==='water'){ctx.fillStyle='#507179';ctx.beginPath();ctx.ellipse(x,y,17,10,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#94c0c2';ctx.beginPath();ctx.ellipse(x,y,11,5,0,0,Math.PI*2);ctx.stroke();line(ctx,x-6,y,x+8,y,'#c1d4c480');}
  else if(node.resource==='ether'){polygon(ctx,[[x-7,y],[x-9,y-12],[x,y-26],[x+10,y-10],[x+6,y]],color);line(ctx,x,y-23,x+2,y-2,'#ebe8e0');}
  else if(node.resource==='food'){for(let i=0;i<4;i++){line(ctx,x+i*4-6,y,x+i*4-7,y-10-i%2*4,'#99b882',2);circle(ctx,x+i*4-7,y-12-i%2*4,4,'#92af7777');}}
  else{polygon(ctx,[[x-11,y-3],[x-11,y-17],[x+10,y-20],[x+12,y-4]],node.resource==='energy'?'#61695c':'#637374');line(ctx,x-7,y-15,x+7,y-17,color,2);line(ctx,x-5,y-6,x+7,y-8,'#b1bea77a');}
  if(node.id.endsWith('-0')||node.id.endsWith('-1')){const pulse=.35+Math.sin(time/550)*.1;ctx.strokeStyle=color+Math.floor(pulse*255).toString(16).padStart(2,'0');ctx.beginPath();ctx.ellipse(x,y+4,23,12,0,0,Math.PI*2);ctx.stroke();}
 }
 person(ctx,p,color,kind,time,self=false){
  const x=p.x,y=p.y,walk=Math.sin(time/160+p.x*.15)*2;ctx.fillStyle='#07171d55';ctx.beginPath();ctx.ellipse(x,y+4,p.mounted?27:16,7,0,0,Math.PI*2);ctx.fill();
  if(p.mounted){this.vehicle(ctx,{x,y:y+8},time,true);}
  else{line(ctx,x-5,y-6,x-7,y+1+walk,'#a1a89f',5);line(ctx,x+5,y-6,x+7,y+1-walk,'#b2b7a9',5);}
  polygon(ctx,[[x-11,y-32],[x+10,y-33],[x+12,y-7],[x-12,y-7]],mix(color,'#263c40',.6));polygon(ctx,[[x-12,y-30],[x-17,y-8],[x-7,y-5],[x-2,y-32]],color+'b0');line(ctx,x-14,y-29,x-18,y-16,'#c2c4ac',5);line(ctx,x+12,y-28,x+17,y-15,'#c2c4ac',5);circle(ctx,x,y-40,8,'#d2bea1');polygon(ctx,[[x-8,y-42],[x-6,y-50],[x+6,y-49],[x+9,y-39],[x+4,y-42]],kind==='npc'?'#615341':'#4b5452');line(ctx,x-5,y-38,x+3,y-38,'#20333a',2);circle(ctx,x+3,y-38,1,color);line(ctx,x-8,y-24,x+8,y-24,color,2);
  if(kind==='warrior'){line(ctx,x+15,y-15,x+22,y-43,'#e3c4a1',3);line(ctx,x+20,y-37,x+22,y-43,'#c9e5d3',4);}
  else if(kind==='archer'){ctx.strokeStyle='#b9c99b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+13,y-21,13,-1.2,1.3);ctx.stroke();line(ctx,x+17,y-33,x+17,y-9,'#dee0b77a');}
  else if(kind==='tank'){polygon(ctx,[[x-22,y-29],[x-9,y-32],[x-8,y-12],[x-17,y-5],[x-25,y-15]],'#688e9b','#b3cdcb');line(ctx,x-17,y-26,x-17,y-13,'#c8d7bd',2);}
  else if(kind==='lumen'||kind==='umbra'){line(ctx,x+16,y-9,x+16,y-46,'#8f998c',2);const point=kind==='lumen'?'#e9d392':'#bba5e0';glow(ctx,x+16,y-48,22,point+'35');polygon(ctx,[[x+16,y-55],[x+21,y-48],[x+16,y-41],[x+11,y-48]],point);}
  if(self){ctx.strokeStyle='#d8cb9b77';ctx.beginPath();ctx.ellipse(x,y+3,21,10,0,0,Math.PI*2);ctx.stroke();}
 }
 monster(ctx,m,selected,time){
  const x=m.x,y=m.y,s=m.boss?2.3:1,region=REGIONS[m.region],color=region.accent;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#09171d66';ctx.beginPath();ctx.ellipse(0,4,22,9,0,0,Math.PI*2);ctx.fill();
  if(m.kind===0){const wiggle=Math.sin(time/150+m.x)*2;for(let i=-1;i<=1;i++){line(ctx,i*10,-5,i*15-8,4+wiggle,'#6c847c',3);line(ctx,i*10,-8,i*15+6,-18-wiggle,'#74897c',3);}polygon(ctx,[[-14,-12],[-8,-25],[8,-24],[16,-11],[7,-1],[-9,-2]],mix(color,'#2c4043',.5));circle(ctx,-4,-15,2,color);circle(ctx,5,-15,2,color);}
  else if(m.kind===1){const hover=Math.sin(time/600+m.x)*3;polygon(ctx,[[-23,-20+hover],[-8,-28+hover],[10,-26+hover],[24,-17+hover],[10,-10+hover],[-10,-12+hover]],'#5f7776');polygon(ctx,[[-7,-28+hover],[7,-29+hover],[12,-13+hover],[-12,-13+hover]],mix(color,'#344b4c',.5));glow(ctx,0,-21+hover,18,color+'35');circle(ctx,0,-21+hover,3,color);line(ctx,-22,-19+hover,22,-18+hover,'#b4c4a355');}
  else{line(ctx,-9,-8,-14,2,'#6b766b',4);line(ctx,8,-8,12,2,'#7b8275',4);polygon(ctx,[[-16,-10],[-11,-34],[9,-39],[17,-18],[11,-5]],mix(color,'#2c4140',.6));polygon(ctx,[[-10,-36],[-3,-49],[9,-40],[10,-33]],'#899385');circle(ctx,4,-36,2,color);line(ctx,-14,-22,-24,-10,'#9b9c85',4);line(ctx,13,-20,23,-33,'#b4b79f',4);}
  ctx.restore();if(selected){ctx.strokeStyle='#d8b08a';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y+6,28*s,12*s,0,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;}
  this.health(ctx,x,y-56*s,m.hp/m.maxHp,40*s,m.boss?'#bc9871':'#a57562');if(selected||m.boss){this.label(ctx,x,y-64*s,m.name,m.boss?'#ecd29d':'#c9d0b8',m.boss?10:8);this.label(ctx,x,y-78*s,'NV. '+m.level,'#aeb5a7',7);}
 }
 vehicle(ctx,p,time,small=false){ctx.save();ctx.translate(p.x,p.y);if(small)ctx.scale(.7,.7);polygon(ctx,[[-26,3],[-24,-22],[17,-28],[30,-10],[27,7]],'#5b7473','#a8b39a77');polygon(ctx,[[-21,-19],[15,-25],[23,-13],[-18,-10]],'#253c44');circle(ctx,-14,5,7,'#182b31');circle(ctx,20,2,7,'#182b31');line(ctx,-24,-7,24,-12,'#d2bd83',2);glow(ctx,27,-11,22,'#d8c38522');ctx.restore();}
 health(ctx,x,y,fraction,width,color){ctx.fillStyle='#162329';ctx.fillRect(x-width/2,y,width,3);ctx.fillStyle=color;ctx.fillRect(x-width/2,y,width*clamp(fraction,0,1),3);}
 label(ctx,x,y,text,color,size){if(!text)return;ctx.font=`${size}px system-ui, sans-serif`;ctx.textAlign='center';ctx.fillStyle='#06131999';ctx.fillText(text,x+1,y+1);ctx.fillStyle=color;ctx.fillText(text,x,y);}
 effect(ctx,time){
  this.effects=this.effects.filter(e=>time-e.born<1800);
  for(const e of this.effects){const age=(time-e.born)/1000,alpha=Math.max(0,1-age/.9);ctx.globalAlpha=alpha;
   if(e.type==='damage'||e.type==='heal'||e.type==='reward'){this.label(ctx,e.x,e.y-42-age*24,e.type==='reward'?e.text:(e.type==='heal'?'+':'−')+Math.round(e.value),e.type==='heal'?'#b8dba3':e.type==='reward'?'#e8cc92':'#eee1c4',e.type==='reward'?8:15);}
   else if(e.type==='attack'||e.type==='summon'){const color=e.classId?CLASSES[e.classId].color:'#b8d7b2';line(ctx,e.x,e.y-25,e.targetX,e.targetY-20,color+Math.floor(alpha*255).toString(16).padStart(2,'0'),e.critical?4:2);circle(ctx,e.targetX,e.targetY-20,10*age+2,color+'55');}
   else if(e.type==='skill'){const color=CLASSES[e.classId].color;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y,15+age*110,10+age*70,0,0,Math.PI*2);ctx.stroke();if(e.targetX)line(ctx,e.x,e.y-22,e.targetX,e.targetY-25,color,4);ctx.lineWidth=1;}
   else if(e.type==='pulse'){ctx.strokeStyle='#bf8bb7';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,Math.min(e.radius,age*160+20),0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;}
   else if(e.type==='level'||e.type==='collect'||e.type==='discover'||e.type==='mechanic'){glow(ctx,e.x,e.y-18,40+age*100,'#e3cc8950');this.label(ctx,e.x,e.y-60-age*18,e.type==='level'?'NÍVEL '+e.level:e.type==='collect'?'+'+e.value:e.text||'REGIÃO DESCOBERTA','#f0d59a',12);}
   ctx.globalAlpha=1;
  }
 }
 atmosphere(ctx,state,time){
  const night=state?Math.max(0,Math.cos(state.daylight*Math.PI*2))*.14:.09;ctx.fillStyle=`rgba(8,17,31,${night})`;ctx.fillRect(0,0,this.width,this.height);const weather=state?.weather.id||'clear';
  for(let i=0;i<(weather==='acid'?65:32);i++){const x=((i*173+time*(weather==='acid'?.12:.012))%(this.width+80))-40,y=((i*237+time*(weather==='acid'?.55:.024))%(this.height+80))-40;if(weather==='acid')line(ctx,x,y,x-5,y+14,'#9bb89933');else circle(ctx,x,y,.8+(i%3)*.35,'#d9d6b633');}
  if(weather==='ether'||weather==='eclipse'){ctx.fillStyle=weather==='ether'?'#9470ab0b':'#2c184921';ctx.fillRect(0,0,this.width,this.height);}if(weather==='aurora'){const light=ctx.createLinearGradient(0,0,this.width,this.height);light.addColorStop(0,'#e2cf940e');light.addColorStop(.7,'#bcddd608');light.addColorStop(1,'#abcdef00');ctx.fillStyle=light;ctx.fillRect(0,0,this.width,this.height);}
 }
 drawMinimap(state){const ctx=this.mini,w=this.minimap.width,h=this.minimap.height,r=state.region;ctx.fillStyle=mix(r.color,'#12232b',.6);ctx.fillRect(0,0,w,h);const pos=p=>({x:(p.x-r.x)/2400*w,y:(p.y-r.y)/1800*h});ctx.strokeStyle='#bba77733';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(0,h*740/1800);ctx.lineTo(w,h*740/1800);ctx.stroke();ctx.lineWidth=1;
  for(const npc of NPCS.filter(n=>n.region===r.index)){const p=pos(npc);circle(ctx,p.x,p.y,2.5,'#ddc389');}for(const tower of state.towers.filter(t=>t.region===r.index)){const p=pos(tower);polygon(ctx,[[p.x,p.y-4],[p.x+4,p.y],[p.x,p.y+4],[p.x-4,p.y]],state.player.towers.includes(r.index)?'#e4cc8a':'#82999a');}
  for(const m of state.monsters){const p=pos(m);circle(ctx,p.x,p.y,m.boss?3:1.5,m.boss?'#c89075':'#a5796a99');}for(const ally of state.players){if(regionAt(ally.x,ally.y).index!==r.index)continue;const p=pos(ally);circle(ctx,p.x,p.y,2,'#98c2b3');}const p=pos(state.player);circle(ctx,p.x,p.y,4,'#e3c480');circle(ctx,p.x,p.y,1.5,'#142932');
 }
}
