import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=path.join(root,'.local/ragnarok/browser-build');
const runner=path.join(browser,'node_modules/vitest/vitest.mjs');
if(!fs.existsSync(runner))throw Error('Prepare o cliente upstream e suas dependências antes de validar os loaders.');
const destination=path.join(browser,'tests/loaders/QuestWorld.test.js');
fs.copyFileSync(path.join(root,'client/ragnarok/tests/native-world.vitest.js'),destination);
const result=spawnSync(process.execPath,[runner,'run','tests/loaders/QuestWorld.test.js'],{
 cwd:browser,stdio:'inherit',env:{...process.env,QUEST_WORLD_DATA:path.join(root,'content/eridan/data')}
});
process.exit(result.status??1);
