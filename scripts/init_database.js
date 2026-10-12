import {mkdir,writeFile,stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';

const directory=resolve('.local');
await mkdir(directory,{recursive:true,mode:0o700});
const credentials=resolve(directory,'database.env');
try{await stat(credentials);console.log('Existing database credentials preserved.');}
catch(error){
 if(error.code!=='ENOENT')throw error;
 const password=randomBytes(32).toString('hex');
 const files={
  'database.env':`POSTGRES_DB=quest\nPOSTGRES_USER=quest\nPOSTGRES_PASSWORD=${password}\n`,
  'backend.env':`DATABASE_URL=postgresql://quest:${password}@postgres:5432/quest\nHOST=0.0.0.0\nPORT=3000\nNODE_ENV=production\n`,
  'backend-local.env':`DATABASE_URL=postgresql://quest:${password}@127.0.0.1:15432/quest\nHOST=127.0.0.1\nPORT=3003\n`,
 };
 for(const [name,content]of Object.entries(files))await writeFile(resolve(directory,name),content,{flag:'wx',mode:0o600});
 console.log('Real PostgreSQL configuration generated in protected local files; no passwords printed.');
}
