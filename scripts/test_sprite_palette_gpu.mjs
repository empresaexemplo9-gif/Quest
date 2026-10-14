// Local WebGL regression probe using the exact native sprite fragment shader.
// Open the printed loopback URL; no game credentials or player data are used.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'content/ragnarok/data/sprite/quest');
const html=String.raw`<!doctype html><meta charset="utf-8"><title>Éridan — cores e botas</title>
<style>body{background:#13201f;color:#f1ece0;font:16px system-ui;margin:24px}canvas{background:#293a37;border:1px solid #687971;display:block}#outfits{display:grid;grid-template-columns:repeat(8,1fr);gap:12px}figure{margin:0}figcaption{text-align:center;padding:8px}select{font:inherit;padding:8px;margin:10px}#result{padding:12px;background:#233b32}</style>
<h1>Éridan — cores das armaduras, roupas e botas</h1><p id="result">Verificando os 256 índices da paleta na GPU…</p>
<label>Classe <select id="family"><option value="sword">Espadachim</option><option value="novice">Aprendiz</option><option value="mage">Mago</option><option value="archer">Arqueiro</option><option value="acolyte">Noviço</option><option value="merchant">Mercador</option><option value="thief">Gatuno</option></select></label>
<label>Roupa <select id="style"><option value="standard">Referência inicial</option><option value="epic">Épica</option></select></label><div id="outfits"></div>
<script type="module">
const labels=['Natural','Vermelho','Azul','Verde','Violeta','Dourado','Prata','Preto'];
const shader=await (await fetch('/fixed.fs')).text(),oldShader=await (await fetch('/upstream.fs')).text();
const vertex='#version 300 es\nin vec2 position;out vec2 vTextureCoord;void main(){gl_Position=vec4(position,0,1);vTextureCoord=(position+1.0)*.5;}';
function render(canvas,w,h,data,palette,fragment=shader){
 const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL 2 indisponível');
 function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
 function texture(unit,width,height,bytes,indexed){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,indexed?gl.R8:gl.RGBA,width,height,0,indexed?gl.RED:gl.RGBA,gl.UNSIGNED_BYTE,bytes);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);}
 texture(0,w,h,data,true);texture(1,256,1,palette,false);
 const u=n=>gl.getUniformLocation(program,n);gl.uniform1i(u('uDiffuse'),0);gl.uniform1i(u('uPalette'),1);gl.uniform1i(u('uUsePal'),1);gl.uniform1f(u('uShadow'),1);gl.uniform4f(u('uSpriteRendererColor'),1,1,1,1);gl.uniform2f(u('uTextSize'),w*2,h*2);gl.viewport(0,0,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,6);
 const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);if(gl.getError()!==gl.NO_ERROR)throw Error('Erro WebGL');return {pixels,gl};
}
const indexed=Uint8Array.from({length:256},(_,i)=>i),palette=new Uint8Array(1024);for(let i=1;i<256;i++)palette.set([i,255-i,(i*17)%256,255],i*4);
function probe(fragment){const c=document.createElement('canvas');c.width=256;c.height=1;const {pixels,gl}=render(c,256,1,indexed,palette,fragment);let wrong=0;for(let i=0;i<1024;i++)if(Math.abs(pixels[i]-palette[i])>1)wrong++;gl.getExtension('WEBGL_lose_context')?.loseContext();return wrong;}
const before=probe(oldShader),after=probe(shader);document.querySelector('#result').textContent='GPU: '+after+' canais incorretos após a correção (antes: '+before+'). Índice 255, transparência e cores conferidos.';document.querySelector('#result').dataset.passed=String(after===0&&before>0);
async function outfits(){
 const parent=document.querySelector('#outfits');for(const c of parent.querySelectorAll('canvas'))c.getContext('webgl2').getExtension('WEBGL_lose_context')?.loseContext();parent.replaceChildren();
 const key=document.querySelector('#family').value+'-'+document.querySelector('#style').value;const sprite=await (await fetch('/sprite?key='+key)).json();
 for(let color=0;color<8;color++){const f=document.createElement('figure'),c=document.createElement('canvas'),label=document.createElement('figcaption');c.width=sprite.width;c.height=sprite.height;c.style.width='100%';label.textContent=labels[color];f.append(c,label);parent.append(f);const pal=color?new Uint8Array(await (await fetch('/palette?key='+key+'&color='+color)).arrayBuffer()):new Uint8Array(sprite.palette);const data=new Uint8Array(sprite.data);const flipped=new Uint8Array(data.length);for(let y=0;y<sprite.height;y++)flipped.set(data.subarray(y*sprite.width,(y+1)*sprite.width),(sprite.height-y-1)*sprite.width);render(c,sprite.width,sprite.height,flipped,pal);}
}
document.querySelector('#family').onchange=outfits;document.querySelector('#style').onchange=outfits;await outfits();
</script>`;
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1');response.setHeader('Cache-Control','no-store');
 if(url.pathname==='/'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);return;}
 if(url.pathname==='/fixed.fs'||url.pathname==='/upstream.fs'){const file=url.pathname==='/fixed.fs'?'client/ragnarok/mods/SpritePaletteQuest.fs':'.local/ragnarok/vendor/roBrowserLegacy/src/Renderer/SpriteRenderer.fs';response.end(fs.readFileSync(path.join(root,file)));return;}
 const key=url.searchParams.get('key');if(!/^(novice|sword|mage|archer|acolyte|merchant|thief)-(standard|epic)$/.test(key||'')){response.writeHead(400);response.end();return;}
 if(url.pathname==='/palette'){const color=url.searchParams.get('color');if(!/^[1-7]$/.test(color||'')){response.writeHead(400);response.end();return;}response.end(fs.readFileSync(path.join(base,key+'-'+color+'.pal')));return;}
 if(url.pathname==='/sprite'){const sprite=fs.readFileSync(path.join(base,key+'.spr'));const w=sprite.readUInt16LE(8),h=sprite.readUInt16LE(10);response.setHeader('Content-Type','application/json');response.end(JSON.stringify({width:w,height:h,data:[...sprite.subarray(12,12+w*h)],palette:[...sprite.subarray(-1024)]}));return;}
 response.writeHead(404);response.end();
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({url:'http://127.0.0.1:'+server.address().port})));
