import {parseArgs} from 'node:util';
import {open,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';

const {values}=parseArgs({options:{file:{type:'string'},database:{type:'string',default:'quest'}}});
if(!values.file||!/^quest(?:_[a-z0-9_]+)?$/.test(values.database))throw new Error('Provide --file and a Quest database name.');
const filename=resolve(values.file);if(!(await stat(filename)).isFile())throw new Error('Backup file not found.');
const database=values.database;
const query="SELECT count(*) FROM information_schema.tables WHERE table_schema='public'";
const output=execFileSync('docker',['compose','exec','-T','postgres','psql','-U','quest','-d',database,'-Atc',query],{encoding:'utf8'}).trim();
if(output!=='0')throw new Error('Refusing to overwrite a database that already contains tables. Stop the game and restore into an empty database.');
const file=await open(filename,'r');
try{
 await new Promise((resolve,reject)=>{
  const child=spawn('docker',['compose','exec','-T','postgres','pg_restore','-U','quest','-d',database,'--no-owner','--single-transaction','--exit-on-error'],{stdio:[file.fd,'ignore','pipe']});
  child.stderr.resume();child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('Restore failed. The restoration transaction was rolled back.')));
 });
 console.log('PostgreSQL backup restored into empty database '+database+'.');
}finally{await file.close();}
