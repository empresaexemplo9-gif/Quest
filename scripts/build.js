import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CLASSES,REGIONS,OPERATIONS} from '../public/game/content.js';
const root=fileURLToPath(new URL('..',import.meta.url));
for(const path of ['public/index.html','public/game/content.js','public/game/core.js','public/game/render.js','public/game/ui.js','public/game/session.js','public/game/main.js','public/sw.js','public/game/isometric.js','public/game/projection.js','public/game/ragnarok.css','public/art/abrigo77.png','public/art/characters.png','public/art/regions.png','public/game/tablet.css','public/icons/apple-touch-icon.png']){const content=await readFile(resolve(root,path));if(!content.length)throw new Error('Empty build asset: '+path);}
if(Object.keys(CLASSES).length!==5||REGIONS.length!==8||OPERATIONS.length!==4)throw new Error('Game content is incomplete.');
await writeFile(resolve(root,'public/game/version.json'),JSON.stringify({version:'1.3.0',classes:5,regions:8,operations:4}));
console.log('Build complete: original game client, five classes, eight regions and four operations.');
