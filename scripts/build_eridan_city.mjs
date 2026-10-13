// Original editable native assets. Explicit generation only; back up BrowEdit edits first.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'content/eridan/data'), N=96;
const bytes=(...p)=>Buffer.concat(p);
const i=(...v)=>{const b=Buffer.alloc(v.length*4);v.forEach((x,k)=>b.writeInt32LE(x,k*4));return b;};
const f=(...v)=>{const b=Buffer.alloc(v.length*4);v.forEach((x,k)=>b.writeFloatLE(x,k*4));return b;};
const s=(v,n)=>{const b=Buffer.alloc(n);b.write(v,0,n,'ascii');return b;};
const sh=(...v)=>{const b=Buffer.alloc(v.length*2);v.forEach((x,k)=>b.writeUInt16LE(x,k*2));return b;};
function write(name,b){const p=path.join(data,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);}
const textures=['grass','cobble','concrete','plaster','metal','glass','moss','bark','leaves','rust','dirt','rubble','energy','wood','roof','canvas'];
for(const name of textures)if(!fs.existsSync(path.join(data,'texture/eridan',name+'.bmp')))throw Error('Prepare original materials with scripts/prepare_eridan_materials.py first.');
const T=Object.fromEntries(textures.map((v,k)=>[v,k]));
const hash=(x,y=0)=>{let a=Math.imul((x|0)^0x4b45,(y|0)^0x9e37);a^=a>>>13;return (a>>>0)/4294967295;};

class Mesh {
  vertices=[];uv=[];faces=[];
  polygon(points,material,smooth=0){
    const at=this.vertices.length,ut=this.uv.length;
    this.vertices.push(...points.map(([x,y,z])=>[x,-y,z]));
    this.uv.push(...(points.length===4?[[0,1],[1,1],[1,0],[0,0]]:[[0,1],[1,1],[.5,0]]));
    this.faces.push([at,at+1,at+2,ut,ut+1,ut+2,T[material],smooth]);
    if(points.length===4)this.faces.push([at,at+2,at+3,ut,ut+2,ut+3,T[material],smooth]);
  }
  box(x,y,z,w,h,d,material){
    const v=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],
             [x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];
    for(const q of [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]])this.polygon(q.map(k=>v[k]),material);
  }
  beam(a,b,r1,r2,material,sides=8){
    const n=b.map((v,k)=>v-a[k]),len=Math.hypot(...n);for(let k=0;k<3;k++)n[k]/=len;
    let u=Math.abs(n[1])>.9?[1,0,0]:[-n[2],0,n[0]];const ul=Math.hypot(...u);u=u.map(v=>v/ul);
    const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
    const point=(p,r,t)=>p.map((q,k)=>q+r*(Math.cos(t)*u[k]+Math.sin(t)*v[k]));
    for(let k=0;k<sides;k++){
      const t=k*2*Math.PI/sides,t2=(k+1)*2*Math.PI/sides;
      const p=point(a,r1,t),q=point(a,r1,t2),r=point(b,r2,t2),z=point(b,r2,t);
      this.polygon([p,q,r,z],material);this.polygon([a,q,p],material);this.polygon([b,z,r],material);
    }
  }
  orb(x,y,z,rx,ry,rz,material,seed=0){
    const rings=5,sides=10;
    const point=(lat,lon)=>{
      const radius=1+.08*Math.sin(lon*3+seed)*Math.cos(lat);
      return [x+rx*Math.cos(lat)*Math.cos(lon)*radius,y+ry*Math.sin(lat),z+rz*Math.cos(lat)*Math.sin(lon)*radius];
    };
    for(let a=0;a<rings;a++)for(let b=0;b<sides;b++){
      const p=-Math.PI/2+a*Math.PI/rings,q=p+Math.PI/rings,l=b*2*Math.PI/sides,m=l+2*Math.PI/sides;
      if(a===0)this.polygon([point(p,l),point(q,m),point(q,l)],material,1);
      else if(a===rings-1)this.polygon([point(p,l),point(p,m),point(q,l)],material,1);
      else this.polygon([point(p,l),point(p,m),point(q,m),point(q,l)],material,1);
    }
  }
  roof(w,d,elevation,rise,material){
    this.polygon([[-w/2,elevation,-d/2],[0,elevation+rise,-d/2],[0,elevation+rise,d/2],[-w/2,elevation,d/2]],material);
    this.polygon([[0,elevation+rise,-d/2],[w/2,elevation,-d/2],[w/2,elevation,d/2],[0,elevation+rise,d/2]],material);
    this.polygon([[-w/2,elevation,-d/2],[w/2,elevation,-d/2],[0,elevation+rise,-d/2]],'plaster');
    this.polygon([[w/2,elevation,d/2],[-w/2,elevation,d/2],[0,elevation+rise,d/2]],'plaster');
    this.beam([0,elevation+rise,-d/2-1],[0,elevation+rise,d/2+1],1.2,1.2,'metal');
  }
  save(name){
    const node=bytes(s('root',40),s('',40),i(textures.length),i(...textures.map((_,k)=>k)),f(1,0,0,0,1,0,0,0,1),
      f(0,0,0),f(0,0,0,0,0,1,0,1,1,1),i(this.vertices.length),...this.vertices.map(v=>f(...v)),
      i(this.uv.length),...this.uv.map(v=>bytes(Buffer.from([255,255,255,255]),f(...v))),i(this.faces.length),
      ...this.faces.map(v=>bytes(sh(...v.slice(0,7),0),i(1,v[7]))),i(0));
    write('model/eridan/'+name+'.rsm',bytes(Buffer.from('GRSM'),Buffer.from([1,4]),i(0,2),Buffer.from([255]),Buffer.alloc(16),
      i(textures.length),...textures.map(t=>s('eridan/'+t+'.bmp',40)),s('root',40),i(1),node,i(0,0)));
  }
}
function model(name,make){const m=new Mesh();make(m);m.save(name);}
function ivy(m,x,y,z){for(let k=0;k<5;k++)m.orb(x+Math.sin(k*1.7)*2,y+k*3,z,3.2,3,1.6,'moss',k);}
function windows(m,x,z){m.box(x,12,z,10,10,1,'glass');for(const dx of [-5,0,5])m.box(x+dx,11,z+.7,.7,12,1,'metal');for(const y of [11,17,23])m.box(x,y,z+.7,11,.7,1,'metal');m.box(x,10,z+1,13,1.5,4,'concrete');}
function building(m,damaged=false){
  m.box(0,0,0,56,3,46,'concrete');
  m.box(-17,3,0,20,27,42,'plaster');m.box(17,3,0,20,damaged?22:27,42,'plaster');m.box(0,3,-17,14,27,8,'plaster');
  m.box(0,3,17,14,21,2,'wood');m.box(0,24,17,16,6,3,'metal');
  for(const x of [-25,25])for(const z of [-20,20])m.box(x,3,z,3,30,3,'metal');
  for(const x of [-17,17])windows(m,x,22);
  m.box(0,0,25,22,1.2,8,'concrete');m.box(0,1.2,22,18,1.2,5,'concrete');
  if(!damaged)m.roof(60,49,30,11,'roof');
  else {
    m.box(-15,30,0,26,2,47,'roof');m.beam([-28,30,-23],[0,40,-23],1.6,1.6,'rust');m.beam([-28,30,23],[0,40,23],1.6,1.6,'rust');
    for(let k=0;k<6;k++)m.box(10+hash(k)*12,3+k*.5,3+hash(k,3)*13,4+hash(k,9)*5,3,5,'rubble');
  }
  m.box(-19,3,23,10,6,4,'moss');ivy(m,-26,10,22);ivy(m,25,6,22);
}
model('ruin',m=>{building(m,true);m.box(-12,32,-9,7,13,7,'rust');});
for(const damaged of [true,false])model(damaged?'workshop_ruin':'workshop',m=>{
  building(m,damaged);m.box(0,21,28,50,2,18,'canvas');for(const x of [-23,23])m.box(x,0,34,1.4,23,1.4,'metal');
  m.box(17,32,-9,8,13,8,'rust');for(let k=0;k<4;k++)m.box(17,33+k*3,-4.5,8,.6,1,'metal');
  m.box(-14,3,27,13,6,7,'wood');m.box(-14,9,27,15,1,9,'metal');m.box(-12,10,27,3,3,2,'energy');
  m.beam([13,5,24],[13,11,24],4,4,'rust',10);m.box(13,11,24,9,2,9,'metal');
  m.box(0,24,29,13,2,1,'energy');
});
for(const broken of [true,false])model(broken?'greenhouse_frame':'greenhouse',m=>{
  m.box(0,0,0,58,3,46,'concrete');
  for(const x of [-26,26])for(const z of [-21,0,21])m.box(x,3,z,1.6,26,1.6,'metal');
  for(const z of [-21,0,21]){m.beam([-26,29,z],[0,40,z],1,1,'metal');m.beam([0,40,z],[26,29,z],1,1,'metal');}
  for(const x of [-26,0,26])m.beam([x,x===0?40:29,-21],[x,x===0?40:29,21],1,1,'metal');
  for(const x of [-26,26])for(const z of [-11,11]){
    if(!broken||z===-11)m.box(x,7,z,1,20,18,'glass');m.box(x,6,z,1.7,1.4,19,'metal');
  }
  if(!broken){m.roof(54,44,29,11,'glass');m.box(0,3,21,11,23,1,'glass');}
  for(const x of [-15,15]){m.box(x,3,0,14,2,33,'wood');for(const z of [-10,0,10])m.orb(x,7,z,6,4,5,'leaves',z);}
  for(const x of [-20,20])m.orb(x,3,23,5,2,3,'moss',x);
});
for(const on of [false,true])model(on?'tower':'tower_off',m=>{
  m.box(0,0,0,34,5,34,'concrete');m.box(0,5,0,20,9,20,'metal');
  for(const x of [-8,8])for(const z of [-8,8])m.beam([x,14,z],[x*.55,66,z*.55],1.5,1.1,'metal');
  for(let h=18;h<60;h+=12){m.beam([-8,h,-8],[8,h+12,-8],.7,.7,'rust');m.beam([-8,h,8],[8,h+12,8],.7,.7,'metal');}
  m.beam([0,14,0],[0,69,0],4,4,on?'energy':'rust',12);
  for(const h of [20,40,61])m.beam([0,h,0],[0,h+2,0],12,12,'metal',16);
  m.box(0,67,0,14,5,14,'metal');m.beam([0,72,0],[0,83,0],1,.4,'rust');
  m.box(7,18,11,8,11,3,on?'energy':'metal');ivy(m,-12,5,9);
});
for(let variant=0;variant<3;variant++)model(variant?'tree'+variant:'tree',m=>{
  const bend=variant===1?5:-3, height=32+variant*4;
  m.beam([0,0,0],[bend,height,1],3.4,1.5,'bark',9);
  for(let k=0;k<5;k++){const a=k*Math.PI*2/5+variant*.4;m.beam([0,2,0],[Math.cos(a)*8,0,Math.sin(a)*8],1.6,.4,'bark');}
  for(let k=0;k<5;k++){
    const a=k*Math.PI*2/5+variant*.7,cx=Math.cos(a)*12,cz=Math.sin(a)*10,cy=height+3+hash(k,variant)*7;
    m.beam([bend,height-10,0],[cx,cy-4,cz],1.4,.5,'bark');m.orb(cx,cy,cz,13+hash(k)*3,10+hash(k,6)*4,12,'leaves',k+variant);
  }
  m.orb(bend,height+12,0,13,11,13,'leaves',variant);m.orb(-3,3,3,6,2,5,'moss');
});
model('shrub',m=>{for(const [x,y,z] of [[-3,4,0],[3,5,2],[0,7,-2]])m.orb(x,y,z,6,5,5,'leaves',x);});
model('fern',m=>{
  for(let k=0;k<9;k++){
    const a=k*2*Math.PI/9,dx=Math.cos(a),dz=Math.sin(a);
    m.polygon([[0,0,0],[dx*5-dz,5,dz*5+dx],[dx*11,1.5,dz*11],[dx*5+dz,5,dz*5-dx]],'leaves');
    m.beam([0,0,0],[dx*6,4,dz*6],.14,.1,'bark',4);
  }
});
model('wall',m=>{m.box(0,0,0,30,2,9,'concrete');for(const x of [-13,13])m.box(x,2,0,3,15,7,'metal');m.box(0,2,0,24,11,4,'plaster');m.box(0,13,0,30,1.4,8,'rust');ivy(m,-5,4,3);});
model('bench',m=>{for(const x of [-7,7])m.box(x,0,0,2,5,7,'metal');m.box(0,5,0,19,1.5,8,'wood');m.box(0,6,-3.5,19,6,1.2,'wood');});
model('crate',m=>{m.box(0,0,0,9,9,9,'wood');for(const x of [-4,4])for(const z of [-4,4])m.box(x,0,z,.8,9,.8,'metal');for(const y of [1,7])m.box(0,y,4.6,10,.7,.6,'rust');});
model('salvage',m=>{m.box(-5,0,0,9,7,9,'wood');m.box(5,0,1,9,5,8,'metal');m.beam([6,5,-2],[6,9,-2],3,3,'rust');m.box(-3,7,0,6,3,7,'rust');});
model('planter',m=>{m.box(0,0,0,14,4,12,'concrete');m.box(0,4,0,12,.4,10,'dirt');m.orb(-3,7,0,5,4,4,'leaves');m.orb(3,6,1,4,3,4,'leaves');});
model('lamp',m=>{m.box(0,0,0,6,1.5,6,'concrete');m.beam([0,1,0],[0,25,0],.8,.6,'metal');m.box(0,25,0,7,1.4,7,'metal');m.box(0,21,0,3,4,3,'glass');m.box(0,22,0,2,2,2,'energy');});
model('cistern',m=>{
  for(let k=0;k<16;k++){
    const a=k*2*Math.PI/16,b=(k+1)*2*Math.PI/16,p=(r,h,t)=>[Math.cos(t)*r,h,Math.sin(t)*r];
    m.polygon([p(13,0,a),p(13,0,b),p(13,4,b),p(13,4,a)],'concrete');
    m.polygon([p(13,4,a),p(13,4,b),p(10,4,b),p(10,4,a)],'concrete');
    m.polygon([[0,2,0],p(10,2,b),p(10,2,a)],'glass');
  }
  m.beam([0,2,0],[0,15,0],2.5,2,'metal',10);m.orb(0,16,0,4,4,4,'energy');
});
model('arch',m=>{for(const x of [-17,17]){m.box(x,0,0,5,28,8,'plaster');m.box(x,26,0,7,3,10,'metal');ivy(m,x,5,4);}m.box(0,29,0,38,4,9,'metal');m.box(0,30,4.8,16,1,1,'energy');});
model('rubble',m=>{for(let k=0;k<7;k++)m.orb((hash(k)*2-1)*9,2+hash(k,4)*2,(hash(k,3)*2-1)*6,3+hash(k)*3,2+hash(k,7)*2,3,'rubble',k);});

const structures=[{name:'Abrigo 77',x:24,y:70,w:12,d:10,model:'ruin'},
 {name:'Oficina de sucata',x:24,y:48,w:12,d:10,model:'workshop'},
 {name:'Estufa comunitaria',x:72,y:48,w:13,d:10,model:'greenhouse'},
 {name:'Torre Helios',x:48,y:74,w:9,d:9,model:'tower'}];
const npcs=[[48,34],[22,39],[72,39],[48,65]],collection=[[34,60],[62,58],[60,72]],spawn=[48,28],exit=[48,20];
const props=[],trees=[];
function prop(model,x,y,w=0,d=0,rotation=0,scale=1,label=model){const angle=rotation*Math.PI/180;props.push({model,x,y,w:Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*d,d:Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*d,rotation,scale,label});}
// Keep a readable route through the village; details occupy gardens and road edges.
for(const [x,y] of [[12,12],[24,11],[34,13],[64,12],[76,13],[85,12],[11,26],[84,25],[11,39],[85,39],
 [10,57],[86,58],[11,72],[86,72],[12,85],[25,85],[35,84],[64,85],[76,85],[85,85],[34,70],[68,70],[35,23],[64,25],
 [18,30],[78,31],[17,61],[78,62],[34,83],[62,80]])trees.push({x,y,variant:trees.length%3,scale:.8+hash(x,y)*.28});
for(const a of trees)prop(a.variant?'tree'+a.variant:'tree',a.x,a.y,3,3,hash(a.x,a.y)*360,a.scale,'Arvore da mata retomada');
for(const [x,y] of [[40,30],[56,30],[37,53],[60,53],[39,62],[57,62]])prop('planter',x,y,3,2.6,0,1,'Jardineira comunitaria');
for(const [x,y,r] of [[39,35,90],[57,35,-90],[39,47,90],[57,47,-90],[31,55,0],[66,55,0]])prop('bench',x,y,4,2,r,1,'Banco de madeira reaproveitada');
prop('cistern',48,50,5.2,5.2,0,1,'Cisterna da praca');
for(const [x,y] of [[41,25],[55,25],[36,41],[61,41],[42,61],[54,61],[19,39],[77,39]])prop('lamp',x,y,1.2,1.2,0,1,'Luminaria de Helios');
for(const [x,y] of [[17,41],[30,43],[18,56],[30,57],[66,42],[78,56],[32,61],[62,61]])prop('salvage',x,y,3,3,hash(x,y)*90,.8,'Sucata organizada');
for(const [x,y] of [[19,58],[29,61],[66,58],[79,40],[20,76]])prop('crate',x,y,1.8,1.8,hash(x,y)*30,1,'Caixa de suprimentos');
for(const [x,y] of [[30,67],[18,68],[66,76],[74,73],[29,76]])prop('rubble',x,y,3.5,2.5,hash(x,y)*360,1,'Ruina desmoronada');
for(let x=16;x<=80;x+=6)if(x<39||x>57)prop('wall',x,16,6,1.8,0,1,'Muralha recuperada');
prop('arch',48,17,0,0,0,1,'Portico da Chama Viva');
// Natural clusters are deliberately irregular, without checkerboard patches or cubic crowns.
for(let k=0;k<74;k++){
  const x=8+hash(k,51)*80,y=8+hash(k,97)*80;
  if(road(x,y)||structures.some(a=>Math.abs(x-a.x)<a.w/2+2&&Math.abs(y-a.y)<a.d/2+2)||npcs.concat(collection).some(([nx,ny])=>Math.hypot(x-nx,y-ny)<3))continue;
  prop(k%3?'fern':'shrub',x,y,0,0,hash(k)*360,.65+hash(k,14)*.6,'Vegetacao rasteira');
}
function road(x,y){
  return (Math.abs(x-48)<=4&&y>=16&&y<=84)||Math.hypot((x-48)*.92,y-43)<16||
    (x>=18&&x<=78&&y>=37&&y<=42)||
    (x>=20&&x<=29&&y>=39&&y<=66)||(x>=68&&x<=76&&y>=39&&y<=55)||
    (x>=31&&x<=65&&y>=57&&y<=62);
}
function blocked(x,y){
  if(x<5||y<5||x>N-6||y>N-6)return true;
  if(structures.some(a=>Math.abs(x-a.x)<=a.w/2&&Math.abs(y-a.y)<=a.d/2))return true;
  if(y>=16&&y<=18&&(Math.abs(x-44.6)<.8||Math.abs(x-51.4)<.8))return true;
  return props.some(a=>a.w&&Math.abs(x-a.x)<=a.w/2&&Math.abs(y-a.y)<=a.d/2);
}
const groundTextures=['grass','cobble','concrete','dirt','trail','meadow','overgrown',...Array.from({length:14},(_,k)=>'road_'+String(k+1).padStart(2,'0'))];
const groundIndex=Object.fromEntries(groundTextures.map((n,k)=>[n,k]));
function terrainMaterial(x,y){
  const bits=[road(x,y+2),road(x+2,y+2),road(x,y),road(x+2,y)].reduce((n,v,k)=>n+(v?1<<k:0),0);
  if(bits===15)return groundIndex[Math.hypot(x-48,y-43)<10?'concrete':'cobble'];
  if(bits)return groundIndex['road_'+String(bits).padStart(2,'0')];
  if(structures.some(a=>Math.abs(x-a.x)<a.w/2+2&&Math.abs(y-a.y)<a.d/2+2))return groundIndex.trail;
  const field=Math.sin(x*.11+y*.07)+Math.cos(y*.19-x*.03);
  return groundIndex[field>.95?'overgrown':field<-.7?'meadow':'grass'];
}
function shadow(x,y){
  let value=0;
  for(const a of trees)value=Math.max(value,Math.exp(-(((x-a.x-2)/4.5)**2+((y-a.y+1)/3.5)**2))*.3);
  for(const a of structures){const dx=Math.max(0,Math.abs(x-a.x-1.5)-a.w/2),dy=Math.max(0,Math.abs(y-a.y+1)-a.d/2);value=Math.max(value,Math.exp(-(dx*dx+dy*dy)/3)*.23);}
  for(const a of props.filter(a=>a.w&&a.model!=='tree'&&a.model!=='tree1'&&a.model!=='tree2'))value=Math.max(value,Math.exp(-(((x-a.x)/Math.max(1,a.w/2))**2+((y-a.y)/Math.max(1,a.d/2))**2))*.16);
  return Math.round(255*(1-value));
}
function ground(){
  const tiles=[],surfaces=[],lightmaps=[];
  for(let y=0;y<N/2;y++)for(let x=0;x<N/2;x++){
    const gx=x*2,gy=N-2-y*2,k=y*N/2+x;
    const light=Buffer.alloc(256);
    for(let py=0;py<8;py++)for(let px=0;px<8;px++)light[py*8+px]=shadow(gx+px/7*2,gy+2-py/7*2);
    lightmaps.push(light);
    const uv=k%4===0?[1,0,1,0,0,0,1,1]:[0,1,0,1,0,0,1,1];
    // Transition orientation is fixed; rotations are only used inside uniform paving/grass.
    const texture=terrainMaterial(gx,gy),transition=texture>=7;
    tiles.push(bytes(f(...(transition?[0,1,0,1,0,0,1,1]:uv)),sh(texture,k),Buffer.from([255,255,255,255])));
    surfaces.push(bytes(f(0,0,0,0),i(k,-1,-1)));
  }
  return bytes(Buffer.from('GRGN'),Buffer.from([1,7]),i(N/2,N/2),f(10),i(groundTextures.length,80),
    ...groundTextures.map(t=>s('eridan/'+t+'.bmp',80)),i(lightmaps.length,8,8,1),...lightmaps,i(tiles.length),...tiles,...surfaces);
}
function world(name,stage){
  const objects=[];
  function object(label,model,x,y,scale=1,rotation=0){objects.push(bytes(i(1),s(label,40),i(0),f(1),i(0),s('eridan/'+model+'.rsm',80),s('',80),f((x-N/2)*5,0,(N/2-y)*5),f(0,rotation,0),f(scale,scale,scale)));}
  for(const a of structures){let model=a.model;if(model==='tower'&&stage<3)model='tower_off';if(model==='workshop'&&stage<1)model='workshop_ruin';if(model==='greenhouse'&&stage<2)model='greenhouse_frame';object(a.name,model,a.x,a.y);}
  for(const a of props)object(a.label,a.model,a.x,a.y,a.scale,a.rotation);
  const quadtree=bytes(...Array.from({length:1365},()=>f(N*2.5,0,N*2.5,-N*2.5,-110,-N*2.5,N*2.5,50,N*2.5,0,-50,0)));
  return bytes(Buffer.from('GRSW'),Buffer.from([2,1]),s('',40),s(name+'.gnd',40),s(name+'.gat',40),s('',40),f(10000),i(0),f(0,0,0),i(3),
    i(40,52),f(.86,.81,.71,.56,.58,.53,.72),i(-N*5,N*5,-N*5,N*5),i(objects.length),...objects,quadtree);
}
const gnd=ground();
for(let stage=0;stage<4;stage++){
  const name='er_chama'+stage,cells=[];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)cells.push(bytes(f(0,0,0,0),i(blocked(x,y)?1:0)));
  write(name+'.gat',bytes(Buffer.from('GRAT'),Buffer.from([1,2]),i(N,N),...cells));write(name+'.gnd',gnd);write(name+'.rsw',world(name,stage));
}
fs.writeFileSync(path.join(root,'content/eridan/city.json'),JSON.stringify({name:'Chama Viva',revision:2,style:'Futuro tomado pela natureza',width:N,height:N,
 maps:[0,1,2,3].map(k=>'er_chama'+k),spawn,structures,npcs,collection,exit,props:props.filter(a=>a.w),
 materials:groundTextures,details:{models:fs.readdirSync(path.join(data,'model/eridan')).length,objects:props.length+structures.length,terrainLightmaps:2304}},null,2)+'\n');
console.log(JSON.stringify({generated:true,maps:4,objects:props.length+structures.length,models:fs.readdirSync(path.join(data,'model/eridan')).length,terrainMaterials:groundTextures.length}));
