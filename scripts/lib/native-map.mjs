// Native rAthena/roBrowser GND, GAT, RSW and RSM primitives. Original Quest assets.
export function nativeToolkit(data, textures, fs, path) {
const bytes=(...p)=>Buffer.concat(p);
const i=(...v)=>{const b=Buffer.alloc(v.length*4);v.forEach((x,k)=>b.writeInt32LE(x,k*4));return b;};
const f=(...v)=>{const b=Buffer.alloc(v.length*4);v.forEach((x,k)=>b.writeFloatLE(x,k*4));return b;};
const s=(v,n)=>{const b=Buffer.alloc(n);b.write(v,0,n,'ascii');return b;};
const sh=(...v)=>{const b=Buffer.alloc(v.length*2);v.forEach((x,k)=>b.writeUInt16LE(x,k*2));return b;};
function write(name,b){const p=path.join(data,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);}
const T=Object.fromEntries(textures.map((v,k)=>[v,k]));
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
return {bytes,i,f,s,sh,Mesh,model,write};
}
