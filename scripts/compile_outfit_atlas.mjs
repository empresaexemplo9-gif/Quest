// Compiles generated 8x7 animation source atlases into native SPR/ACT assets.
// No bitmap output or background replacement: the source PNG remains intact.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {PNG}=require(path.resolve(process.env.QUEST_PNGJS||'node_modules/pngjs'));
const [key,source]=process.argv.slice(2);
if(!/^(novice|sword|mage|archer|acolyte|merchant|thief)-(standard|epic)$/.test(key||'')||!source)throw Error('Use: compile_outfit_atlas.mjs class-style source.png');
const png=PNG.sync.read(fs.readFileSync(source));
function colorKey(x,y,r,g,b){const col=Math.min(7,Math.floor(x*8/png.width)),row=Math.min(6,Math.floor(y*7/png.height)),sx=(x-col*png.width/8)/(png.width/8),sy=(y-row*png.height/7)/(png.height/7);const skin=r>g&&g>b&&r-b<102&&g>56;const protectedPixel=sy<.39||(skin&&sy<.72&&(sx<.42||sx>.58));return (r>>3)*1024+(g>>3)*32+(b>>3)+(protectedPixel?32768:0);}
const histogram=new Map();
for(let i=0;i<png.data.length;i+=4){if(png.data[i+3]<128)continue;const r=png.data[i],g=png.data[i+1],b=png.data[i+2],pixel=i/4,k=colorKey(pixel%png.width,Math.floor(pixel/png.width),r,g,b);let c=histogram.get(k);if(!c){c={k,r:0,g:0,b:0,n:0};histogram.set(k,c);}c.r+=r;c.g+=g;c.b+=b;c.n++;}
const colors=[...histogram.values()].map(c=>({...c,r:c.r/c.n,g:c.g/c.n,b:c.b/c.n}));
if(!colors.length)throw Error('Atlas has no opaque sprites');
const boxes=[colors.filter(c=>c.k<32768),colors.filter(c=>c.k>=32768)].filter(box=>box.length);
while(boxes.length<255){
 let pick=-1,best=-1,axis='r';
 for(let i=0;i<boxes.length;i++){if(boxes[i].length<2)continue;for(const a of ['r','g','b']){const values=boxes[i].map(c=>c[a]),score=(Math.max(...values)-Math.min(...values))*Math.sqrt(boxes[i].reduce((s,c)=>s+c.n,0));if(score>best){best=score;pick=i;axis=a;}}}
 if(pick<0)break;
 const box=boxes[pick].sort((a,b)=>a[axis]-b[axis]);const total=box.reduce((s,c)=>s+c.n,0);let n=0,split=1;for(let i=0;i<box.length-1;i++){n+=box[i].n;if(n>=total/2){split=i+1;break;}}
 boxes.splice(pick,1,box.slice(0,split),box.slice(split));
}
const palette=Buffer.alloc(1024),lookup=new Map(),protectedColors=new Set();
for(let i=0;i<boxes.length;i++){const box=boxes[i],n=box.reduce((s,c)=>s+c.n,0);if(box[0].k>=32768)protectedColors.add(i+1);for(let j=0;j<3;j++)palette[(i+1)*4+j]=Math.round(box.reduce((s,c)=>s+c[['r','g','b'][j]]*c.n,0)/n);palette[(i+1)*4+3]=255;for(const c of box)lookup.set(c.k,i+1);}
const chunks=[Buffer.from([83,80,0,2,56,0,0,0])],frames=[];
for(let row=0;row<7;row++)for(let col=0;col<8;col++){
 const x0=Math.floor(col*png.width/8),x1=Math.floor((col+1)*png.width/8),y0=Math.floor(row*png.height/7),y1=Math.floor((row+1)*png.height/7),w=x1-x0,h=y1-y0;
 const frame=Buffer.alloc(w*h);let opaque=0,bottom=0,top=h;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((y0+y)*png.width+x0+x)*4;if(png.data[i+3]>=128){frame[y*w+x]=lookup.get(colorKey(x0+x,y0+y,png.data[i],png.data[i+1],png.data[i+2]));opaque++;bottom=Math.max(bottom,y);top=Math.min(top,y);}}
 if(opaque<100)throw Error('Empty animation cell '+row+','+col);
 const header=Buffer.alloc(4);header.writeUInt16LE(w,0);header.writeUInt16LE(h,2);chunks.push(header,frame);frames.push({w,h,bottom,top});
}
chunks.push(palette);
const directory='content/ragnarok/data/sprite/quest';fs.mkdirSync(directory,{recursive:true});
fs.writeFileSync(path.join(directory,key+'.spr'),Buffer.concat(chunks));
const act=[];function bytes(n){const b=Buffer.alloc(n);act.push(b);return b;}function i32(n){const b=bytes(4);b.writeInt32LE(n);}function f32(n){const b=bytes(4);b.writeFloatLE(n);}
const head=bytes(16);head.write('AC');head[2]=5;head[3]=2;head.writeUInt16LE(104,4);
const motions=[[0],[1,2,1,2],[6],[6,0],[3],[3,4,3,4],[5],[3],[5],[3],[3,4,3,4],[3,4,3,4],[3,4,3,4]];
const idleHeight=Math.max(...frames.slice(0,8).map(f=>f.bottom-f.top+1));const scale=(key.endsWith('epic')?76:64)/idleHeight;
for(let motion=0;motion<13;motion++)for(let direction=0;direction<8;direction++){
 const poses=motions[motion];i32(poses.length);
 for(const pose of poses){const index=pose*8+direction,f=frames[index];bytes(32);i32(1);i32(0);i32(-Math.round((f.bottom-f.h/2)*scale));i32(index);i32(0);bytes(4).fill(255);f32(scale);f32(scale);i32(motion===8?90:0);i32(0);i32(f.w);i32(f.h);i32(-1);i32(0);}
}
i32(0);for(let i=0;i<104;i++)f32(i>=8&&i<16?5:6);
fs.writeFileSync(path.join(directory,key+'.act'),Buffer.concat(act));
// Native dye palettes preserve neutral details and warm skin colours.
const targets=[[0,0,0],[.95,.18,.16],[.15,.40,.96],[.20,.72,.32],[.62,.23,.85],[.88,.65,.18],[.80,.85,.9],[.17,.19,.23]];
for(let dye=1;dye<8;dye++){const p=Buffer.from(palette);for(let i=1;i<256;i++){let [r,g,b]=[p[i*4]/255,p[i*4+1]/255,p[i*4+2]/255];const high=Math.max(r,g,b),low=Math.min(r,g,b);const saturation=high-low;if(protectedColors.has(i)||saturation<.10)continue;const luminance=.299*r+.587*g+.114*b;const weight=Math.min(.85,saturation*2.5);for(let c=0;c<3;c++){const base=[r,g,b][c],shade=targets[dye][c]*Math.min(1.4,luminance*1.65+.15);p[i*4+c]=Math.round(Math.min(1,base*(1-weight)+shade*weight)*255);}}
 fs.writeFileSync(path.join(directory,key+'-'+dye+'.pal'),p);
}
fs.mkdirSync('content/gm/atlases',{recursive:true});
const preservedSource='content/gm/atlases/'+key+'.png';
if(path.resolve(source)!==path.resolve(preservedSource))fs.copyFileSync(source,preservedSource);
console.log(JSON.stringify({key,frames:56,actions:104,colors:boxes.length,scale,source:{width:png.width,height:png.height},compiled:true}));
