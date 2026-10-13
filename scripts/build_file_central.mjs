import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isShareable,groupFor} from '../server/file-catalog.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.env.VERCEL_ENV){
 const catalog=JSON.parse(await readFile(path.join(root,'public/central/catalogo.json'),'utf8'));
 if(catalog.repository!=='empresaexemplo9-gif/Quest'||!/^[a-f0-9]{40}$/.test(catalog.revision)||!catalog.readOnly||catalog.files.length<5000)throw Error('Invalid published catalog');
 for(const file of catalog.files){
  const encoded=file.path.split('/').map(encodeURIComponent).join('/');
  if(!isShareable(file.path)||file.download!==`https://raw.githubusercontent.com/empresaexemplo9-gif/Quest/${catalog.revision}/${encoded}`||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid public file: '+file.path);
 }
 console.log(`Central: verified ${catalog.files.length} files from published source ${catalog.revision.slice(0,7)}.`);
}else{
let revision=process.env.VERCEL_GIT_COMMIT_SHA,paths,eols=new Map();
try{
 revision ||= execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 paths=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(isShareable);
 for(const entry of execFileSync('git',['ls-files','--eol','-z'],{cwd:root,encoding:'utf8'}).split('\0')){const [flags,name]=entry.split('\t');if(name)eols.set(name,flags);}
 paths=[...new Set([...paths,'public/central/indice.json'])];
 await writeFile(path.join(root,'public/central/indice.json'),JSON.stringify(paths));
}catch{
 paths=JSON.parse(await readFile(path.join(root,'public/central/indice.json'),'utf8')).filter(isShareable);
}
if(!/^[a-f0-9]{40}$/.test(revision))throw Error('Invalid repository revision');
const files=[];
for(const name of paths){
 const filename=path.join(root,...name.split('/')),info=await stat(filename);
 if(!info.isFile())continue;
 const encoded=name.split('/').map(encodeURIComponent).join('/');
 let data=await readFile(filename);
 if(/i\/lf\s+w\/crlf/.test(eols.get(name)||''))data=Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n'));
 files.push({path:name,bytes:data.length,category:groupFor(name),sha256:createHash('sha256').update(data).digest('hex'),download:`https://raw.githubusercontent.com/empresaexemplo9-gif/Quest/${revision}/${encoded}`,view:`https://github.com/empresaexemplo9-gif/Quest/blob/${revision}/${encoded}`});
}
await mkdir(path.join(root,'public/central'),{recursive:true});
await writeFile(path.join(root,'public/central/catalogo.json'),JSON.stringify({repository:'empresaexemplo9-gif/Quest',revision,readOnly:true,files,totalBytes:files.reduce((n,f)=>n+f.bytes,0)}));
console.log(`Central: ${files.length} public files indexed at ${revision.slice(0,7)}.`);
}
