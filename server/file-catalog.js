export function isShareable(name){
 if(typeof name!=='string'||!name||name.includes('\\')||name.startsWith('/')||name.split('/').some(part=>part==='..'||part==='.'))return false;
 const parts=name.split('/');
 if(parts.some(part=>['.local','.git','.vercel','node_modules','__pycache__','memories'].includes(part)))return false;
 if(parts.some(part=>/^\.env/.test(part)&&part!=='.env.example'))return false;
 if(/(?:^|\/)(?:credentials?|secrets?|id_rsa|id_ed25519|token)(?:[.\/]|$)/i.test(name))return false;
 if(/\.(?:pem|key|sqlite|sqlite3|db|dump|bak)$/i.test(name))return false;
 if(['public/central/catalogo.json','public/central/indice.json'].includes(name))return false;
 return true;
}
export function groupFor(name){
 if(name.startsWith('content/eridan/data/'))return 'Mapas e cidades';
 if(name.startsWith('public/art/')||name.startsWith('art/')||name.startsWith('content/ragnarok/data/texture/')||name.startsWith('content/ragnarok/data/sprite/')||name.startsWith('content/gm/atlases/'))return 'Artes e texturas';
 if(name.startsWith('docs/')||name.startsWith('content/eridan/'))return 'História e guias';
 if(name.startsWith('engine/')||name.startsWith('rathena/')||name.startsWith('deploy/')||name.startsWith('server/'))return 'Servidor';
 if(name.startsWith('public/downloads/'))return 'Pacotes e instaladores';
 if(name.startsWith('client/')||name.startsWith('desktop/')||name.startsWith('public/'))return 'Cliente e plataforma';
 return 'Ferramentas do projeto';
}
