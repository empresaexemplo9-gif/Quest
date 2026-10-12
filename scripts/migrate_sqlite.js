import {DatabaseSync} from 'node:sqlite';
import {parseArgs} from 'node:util';
import {createStore} from '../server/store.js';

const {values}=parseArgs({options:{source:{type:'string'}}});
if(!values.source||!process.env.DATABASE_URL)throw new Error('Use --source with the existing SQLite file and a configured PostgreSQL DATABASE_URL.');
const source=new DatabaseSync(values.source,{readOnly:true});
const accountRows=source.prepare('SELECT data FROM accounts').all();
const sessions=source.prepare('SELECT token_hash,account_id,expires FROM sessions').all();
const row=source.prepare('SELECT data FROM world WHERE id=1').get();
if(!row)throw new Error('The source has no game world.');
const world=JSON.parse(row.data),accounts=accountRows.map(r=>JSON.parse(r.data));
if(world.schema!==1||!world.players||!world.guilds)throw new Error('Incompatible source world.');
source.close();
const target=await createStore();
if(target.kind!=='postgres')throw new Error('The migration target must be PostgreSQL.');
try{
 await target.updateWorld(current=>{for(const key of Object.keys(current))delete current[key];Object.assign(current,world);return true;},{
  prepareTransaction:async(client,current)=>{
   const count=await client.query('SELECT count(*) FROM accounts');
   if(Number(count.rows[0].count)>0||Object.keys(current.players).length)throw new Error('Target already contains players. Refusing to overwrite existing data.');
   for(const account of accounts)await client.query('INSERT INTO accounts(id,username,data) VALUES($1,$2,$3::jsonb)',[account.id,account.username,JSON.stringify(account)]);
   for(const session of sessions)if(session.expires>Date.now())await client.query('INSERT INTO sessions(token_hash,account_id,expires) VALUES($1,$2,$3)',[session.token_hash,session.account_id,session.expires]);
  }
 });
 console.log(`Migrated ${accounts.length} accounts and ${Object.keys(world.players).length} characters into PostgreSQL. Source preserved; no credentials printed.`);
}finally{await target.close();}
