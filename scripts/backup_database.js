import {mkdir,chmod,open,rm,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const directory=resolve('.local/backups');await mkdir(directory,{recursive:true,mode:0o700});
const filename=resolve(directory,'quest-'+new Date().toISOString().replaceAll(':','-')+'.dump');
const output=await open(filename,'wx',0o600);
try{
 const result=await new Promise((resolve,reject)=>{
  const child=spawn('docker',['compose','exec','-T','postgres','pg_dump','-U','quest','-d','quest','-Fc'],{stdio:['ignore',output.fd,'pipe']});let error='';
  child.stderr.on('data',chunk=>{error+=chunk;});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('PostgreSQL backup failed; inspect the database service.')));
 });
 await output.close();if((await stat(filename)).size<20)throw new Error('Empty database backup.');
 await chmod(filename,0o600);console.log('Database backup created: '+filename);
}catch(error){await output.close().catch(()=>{});await rm(filename,{force:true});throw error;}
