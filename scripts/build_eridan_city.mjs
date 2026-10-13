// Original, editable RSW/GND/GAT/RSM assets. Run explicitly; never regenerate an edited map on startup.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data = path.join(root,'content/eridan/data');
const N = 96;
const bytes = (...parts) => Buffer.concat(parts);
const i = (...v) => {const b=Buffer.alloc(v.length*4);v.forEach((x,k)=>b.writeInt32LE(x,k*4));return b;};
const f = (...v) => {const b=Buffer.alloc(v.length*4);v.forEach((x,k)=>b.writeFloatLE(x,k*4));return b;};
const s = (v,n) => {const b=Buffer.alloc(n);b.write(v,0,n,'ascii');return b;};
const short = (...v) => {const b=Buffer.alloc(v.length*2);v.forEach((x,k)=>b.writeUInt16LE(x,k*2));return b;};
function write(name,b) {const p=path.join(data,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);}
function bmp(name,color,pattern='noise') {
  const width=256,body=Buffer.alloc(width*width*3);
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const grain=((x*17+y*31+x*y)%13)-6;
    let rgb=color.map(c=>Math.max(0,Math.min(255,c+grain)));
    if(pattern==='metal' && (x%64<3 || y%64<3)) rgb=[29,48,51];
    if(pattern==='glass' && (x%64<5 || y%64<5)) rgb=[39,68,65];
    if(pattern==='moss' && ((x*3+y*7)%71<17)) rgb=[37,93,56];
    if(pattern==='energy' && (x%64>23 && x%64<39)) rgb=[102,238,208];
    const at=(y*width+x)*3;body[at]=rgb[2];body[at+1]=rgb[1];body[at+2]=rgb[0];
  }
  const header=Buffer.alloc(54);header.write('BM');header.writeUInt32LE(54+body.length,2);header.writeUInt32LE(54,10);header.writeUInt32LE(40,14);header.writeInt32LE(width,18);header.writeInt32LE(width,22);header.writeUInt16LE(1,26);header.writeUInt16LE(24,28);
  write('texture/eridan/'+name+'.bmp',bytes(header,body));
}
const textures=['grass','concrete','metal','glass','moss','energy','bark','leaves'];
[[48,91,58],[91,105,106],[72,90,94],[104,171,169],[99,116,95],[20,92,93],[77,67,51],[39,107,64]].forEach((c,k)=>bmp(textures[k],c,['noise','metal','metal','glass','moss','energy','noise','noise'][k]));
function mesh(name,boxes) {
  const verts=[],faces=[];
  for(const [x,y,z,w,h,d,t] of boxes){
    const b=verts.length;
    verts.push([x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y-h,z-d/2],[x-w/2,y-h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y-h,z+d/2],[x-w/2,y-h,z+d/2]);
    for(const q of [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]]) faces.push([b+q[0],b+q[1],b+q[2],t],[b+q[0],b+q[2],b+q[3],t]);
  }
  const node=bytes(s('root',40),s('',40),i(textures.length),i(...textures.map((_,k)=>k)),f(1,0,0,0,1,0,0,0,1),f(0,0,0),f(0,0,0,0,0,1,0,1,1,1),i(verts.length),...verts.map(v=>f(...v)),i(4),...[[0,0],[1,0],[1,1],[0,1]].map(v=>bytes(Buffer.from([255,255,255,255]),f(...v))),i(faces.length),...faces.map(v=>bytes(short(v[0],v[1],v[2],0,1,2,v[3],0),i(1,0))),i(0));
  write('model/eridan/'+name+'.rsm',bytes(Buffer.from('GRSM'),Buffer.from([1,4]),i(0,1),Buffer.from([255]),Buffer.alloc(16),i(textures.length),...textures.map(t=>s('eridan/'+t+'.bmp',40)),s('root',40),i(1),node,i(0,0)));
}
mesh('ruin',[[0,0,0,42,23,35,4],[-15,-23,0,9,24,35,2],[15,-23,0,9,15,35,4],[0,-8,-18,27,14,2,3]]);
mesh('workshop',[[0,0,0,44,30,36,2],[0,-30,0,48,5,40,4],[-13,-8,-19,14,14,2,3],[13,-8,-19,14,14,2,5],[0,-34,0,32,3,24,7]]);
mesh('greenhouse',[[0,0,0,48,3,38,2],[-23,-3,0,3,26,38,2],[23,-3,0,3,26,38,2],[0,-29,0,48,3,38,2],[0,-3,0,42,25,32,3],[0,-32,0,44,2,32,7]]);
mesh('tower',[[0,0,0,27,7,27,4],[0,-7,0,17,55,17,2],[0,-22,-9,8,34,2,5],[0,-62,0,32,6,32,2],[0,-68,0,8,18,8,5]]);
mesh('tower_off',[[0,0,0,27,7,27,4],[0,-7,0,17,45,17,4],[0,-52,0,24,5,24,7]]);
mesh('tree',[[0,0,0,5,24,5,6],[0,-15,0,24,13,24,7],[0,-28,0,19,12,19,7],[0,-40,0,12,9,12,7]]);
mesh('wall',[[0,0,0,30,18,9,4],[0,-18,0,30,3,10,7]]);
const structures=[{name:'Abrigo 77',x:24,y:70,w:12,d:10,model:'ruin'}, {name:'Oficina de sucata',x:24,y:48,w:12,d:10,model:'workshop'}, {name:'Estufa comunitaria',x:72,y:48,w:13,d:10,model:'greenhouse'}, {name:'Torre Helios',x:48,y:74,w:9,d:9,model:'tower'}];
const trees=[];
for(let x=10;x<=86;x+=10)for(let y of [10,86])if(!(x>38&&x<58))trees.push({x,y});
for(let y=20;y<=76;y+=12)for(let x of [10,86])trees.push({x,y});
for(const [x,y] of [[33,68],[69,68],[32,34],[70,30],[18,23],[78,75]])trees.push({x,y});
const walls=[];for(let x=18;x<=78;x+=6)if(x<40||x>56)walls.push({x,y:16});
function blocked(x,y) {
  if(x<5||y<5||x>N-6||y>N-6)return true;
  if(structures.some(a=>Math.abs(x-a.x)<=a.w/2 && Math.abs(y-a.y)<=a.d/2))return true;
  if(trees.some(a=>Math.abs(x-a.x)<=2 && Math.abs(y-a.y)<=2))return true;
  return walls.some(a=>Math.abs(x-a.x)<=3&&Math.abs(y-a.y)<=1);
}
function ground() {
  const tex=['grass','concrete','moss','energy'];
  const tiles=tex.map((_,k)=>bytes(f(0,1,0,1,0,0,1,1),short(k,0),Buffer.from([255,255,255,255])));
  const surfaces=[];
  // GND rows grow toward the south; server GAT rows grow toward the north.
  for(let y=0;y<N/2;y++)for(let x=0;x<N/2;x++){
    const gx=x*2,gy=N-2-y*2;
    const road=Math.abs(gx-48)<=5 || (gy>40&&gy<56&&gx>15&&gx<82) || (gx>37&&gx<60&&gy>25&&gy<39);
    const k=road ? (Math.abs(gx-48)<2?3:1) : ((x*7+y*3)%9===0?2:0);
    surfaces.push(bytes(f(0,0,0,0),i(k,-1,-1)));
  }
  return bytes(Buffer.from('GRGN'),Buffer.from([1,7]),i(N/2,N/2),f(10),i(tex.length,80),...tex.map(t=>s('eridan/'+t+'.bmp',80)),i(1,8,8,1),Buffer.alloc(64,255),Buffer.alloc(192,0),i(tiles.length),...tiles,...surfaces);
}
function world(name,stage) {
  const objects=[];
  function object(label,model,x,y,scale=1,rotation=0) {objects.push(bytes(i(1),s(label,40),i(0),f(1),i(0),s('eridan/'+model+'.rsm',80),s('',80),f((x-N/2)*5,0,(N/2-y)*5),f(0,rotation,0),f(scale,scale,scale)));}
  for(const a of structures)object(a.name,a.model==='tower'&&stage<3?'tower_off':(a.model==='workshop'&&stage<1)||(a.model==='greenhouse'&&stage<2)?'ruin':a.model,a.x,a.y);
  for(const a of trees)object('Vegetacao','tree',a.x,a.y);
  for(const a of walls)object('Muralha reaproveitada','wall',a.x,a.y);
  // RSW's five-level quadtree has 1365 nodes, each containing four vec3 values.
  // Conservative bounds keep every object visible; BrowEdit recalculates precise bounds on save.
  const quadtree=bytes(...Array.from({length:1365},()=>f(N*2.5,0,N*2.5,-N*2.5,-100,-N*2.5,N*2.5,50,N*2.5,0,-50,0)));
  return bytes(Buffer.from('GRSW'),Buffer.from([2,1]),s('',40),s(name+'.gnd',40),s(name+'.gat',40),s('',40),f(10000),i(0),f(0,0,0),i(3),i(45,45),f(.8,.94,.88,.48,.58,.52,.7),i(-N*5,N*5,-N*5,N*5),i(objects.length),...objects,quadtree);
}
for(let stage=0;stage<4;stage++) {
  const name='er_chama'+stage,cells=[];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)cells.push(bytes(f(0,0,0,0),i(blocked(x,y)?1:0)));
  write(name+'.gat',bytes(Buffer.from('GRAT'),Buffer.from([1,2]),i(N,N),...cells));
  write(name+'.gnd',ground());write(name+'.rsw',world(name,stage));
}
fs.writeFileSync(path.join(root,'content/eridan/city.json'),JSON.stringify({name:'Chama Viva',style:'Futuro tomado pela natureza',width:N,height:N,maps:[0,1,2,3].map(k=>'er_chama'+k),spawn:[48,28],structures,npcs:[[48,34],[22,39],[72,39],[48,65]],collection:[[34,60],[62,58],[60,72]],exit:[48,20]},null,2)+'\n');
console.log('Four original Chama Viva maps, seven models and eight textures generated.');
