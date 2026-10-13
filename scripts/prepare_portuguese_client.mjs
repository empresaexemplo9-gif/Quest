// Rebuild the Portuguese overlay from pinned translation sources, preserving table IDs.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const origin='https://raw.githubusercontent.com/hvg249/TranslationRO-BR/0ef37a5df6fa2b6599cd20cced8976b7d56def44/';
const overlay=path.join(root,'content/ragnarok');
const cache=path.join(root,'.local/ragnarok/translation-sources');
fs.mkdirSync(cache,{recursive:true});
const provenance=[];
async function download(filename){
 const response=await fetch(origin+encodeURI(filename));if(!response.ok)throw Error('Translation unavailable: '+filename);
 const bytes=Buffer.from(await response.arrayBuffer());
 provenance.push({source:origin+encodeURI(filename),sha256:createHash('sha256').update(bytes).digest('hex')});
 fs.writeFileSync(path.join(cache,filename.replaceAll('/','_')),bytes);
 return bytes;
}
function decode(bytes){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('windows-1252').decode(bytes);}}
for(const name of ['msgstringtable.txt','idnum2itemdisplaynametable.txt','idnum2itemdesctable.txt','num2itemdisplaynametable.txt','num2itemdesctable.txt','mapnametable.txt','questid2display.txt','tipoftheday.txt','bookitemnametable.txt']){
 let text=decode(await download('data/'+name));
 if(name==='msgstringtable.txt'){
  const baseline=[path.join(root,'.local/ragnarok/overlays/english/data',name),path.join(root,'.local/ragnarok/windows-server/Quest-Servidor/context/.local/ragnarok/overlays/english/data',name)].find(fs.existsSync);
  if(!baseline)throw Error('Prepare the pinned English client before merging message IDs.');
  const english=new TextDecoder('windows-1252').decode(fs.readFileSync(baseline)).split('#'),translated=text.split('#');
  const overrides=JSON.parse(fs.readFileSync(path.join(overlay,'messages-pt.json'),'utf8'));
  const placeholders=value=>value.match(/%(?:\d+\$)?[+\-0-9.]*[sduf%]/g)||[];
  text=english.map((entry,index)=>{
   const value=Object.hasOwn(overrides,index)?'\n'+overrides[index]:translated[index]?.trim()&&!/\?{3}|�/.test(translated[index])?translated[index]:entry;
   if(JSON.stringify(placeholders(entry))!==JSON.stringify(placeholders(value)))throw Error('Message format mismatch at ID '+index);
   return value;
  }).join('#');
 }
 if(name==='mapnametable.txt')text+='\ner_chama0.rsw#Chama Viva - Ruínas#\ner_chama1.rsw#Chama Viva - Oficina#\ner_chama2.rsw#Chama Viva - Estufa#\ner_chama3.rsw#Chama Viva - Torre da Chama#\n';
 fs.writeFileSync(path.join(overlay,'data',name),text,'utf8');
}
// Translate names on the current skill list without replacing level costs/prerequisites.
const translatedNames=decode(await download('data/luafiles514/lua files/skillinfoz/skillinfolist.lua'));
const names=new Map();for(const match of translatedNames.matchAll(/\[SKID\.(\w+)\]\s*=\s*\{[\s\S]*?SkillName\s*=\s*\[\[([^\]]+)\]\]/g))names.set(match[1],match[2]);
const skillRoot=path.join(overlay,'data/luafiles514/lua files/skillinfoz');
const englishSkill=[path.join(root,'.local/ragnarok/overlays/english/data/luafiles514/lua files/skillinfoz/skillinfolist.lub'),path.join(root,'.local/ragnarok/windows-server/Quest-Servidor/context/.local/ragnarok/overlays/english/data/luafiles514/lua files/skillinfoz/skillinfolist.lub')].find(fs.existsSync);
if(!englishSkill)throw Error('Current skill list missing');
let skillText=new TextDecoder('windows-1252').decode(fs.readFileSync(englishSkill));let count=0;
skillText=skillText.replace(/(\[SKID\.(\w+)\]\s*=\s*\{[\s\S]*?SkillName\s*=\s*)("[^"]*"|\[\[[\s\S]*?\]\])/g,(match,prefix,id)=>names.has(id)?(count++,prefix+JSON.stringify(names.get(id))):match);
// Lua strings use the client's Windows-1252 decoder, unlike the UTF-8 text tables.
function cp1252(text){const reverse=new Map(Array.from({length:256},(_,i)=>[new TextDecoder('windows-1252').decode(Uint8Array.of(i)),i]));return Buffer.from([...text].map(ch=>{if(!reverse.has(ch))throw Error('Not Windows-1252: '+ch);return reverse.get(ch);}));}
fs.writeFileSync(path.join(skillRoot,'skillinfolist.lub'),cp1252(skillText));
const descriptions=decode(await download('data/luafiles514/lua files/skillinfoz/skilldescript.lua')).replace('"Quanto maior o nível do Espírito, maior será"','"Quanto maior o nível do Espírito, maior será",');
fs.writeFileSync(path.join(skillRoot,'skilldescript.lub'),cp1252(descriptions));
fs.writeFileSync(path.join(overlay,'SOURCES.json'),JSON.stringify({repository:'https://github.com/hvg249/TranslationRO-BR',revision:'0ef37a5df6fa2b6599cd20cced8976b7d56def44',locale:'pt-BR',translatedSkillNames:count,localModifications:['messages-pt.json','Chama Viva map names','Current skill costs and prerequisites preserved'],coverage:'Client translation with original fallback for entries absent in the community source. Legacy NPC scripts are maintained separately.',inputs:provenance},null,2)+'\n');
console.log(JSON.stringify({locale:'pt-BR',translatedSkillNames:count,files:provenance.length}));
