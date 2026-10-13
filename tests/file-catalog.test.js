import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isShareable,groupFor} from '../server/file-catalog.js';
test('file central excludes private runtimes, credentials, database backups and traversal',()=>{
 for(const name of ['.local/world-smoke.json','.vercel/project.json','.env','.env.production','folder/secrets.json','data/database.sqlite','backup.dump','keys/private.pem','../outside','content/../outside','C:\\private\\file','/absolute','node_modules/runtime.js'])assert.equal(isShareable(name),false,name);
 for(const name of ['.env.example','engine/rathena/sql-files/main.sql','content/eridan/data/er_mata.rsw','public/downloads/Quest-Ragnarok-Setup.exe','docs/mundo-interligado.md'])assert.equal(isShareable(name),true,name);
});
test('editable game materials and server code have their own categories',()=>{
 assert.equal(groupFor('content/eridan/data/er_mata.rsw'),'Mapas e cidades');
 assert.equal(groupFor('public/art/ragnarok/login-pt.png'),'Artes e texturas');
 assert.equal(groupFor('rathena/eridan-world.txt'),'Servidor');
 assert.equal(groupFor('docs/mundo-interligado.md'),'História e guias');
});
