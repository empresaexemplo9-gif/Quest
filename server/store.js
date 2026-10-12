import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {PostgresStore} from './postgres.js';
import {createWorld} from '../public/game/core.js';

export async function createStore({filename,databaseUrl=process.env.DATABASE_URL}={}){
 if(databaseUrl&&!filename)return PostgresStore.open(databaseUrl);
 if(process.env.VERCEL&&!filename)throw new Error('ONLINE_STORAGE_UNAVAILABLE');
 const {DatabaseSync}=await import('node:sqlite');
 return new SqliteStore(filename||process.env.ERIDAN_DB_FILE||'.local/eridan.sqlite',DatabaseSync);
}

export class SqliteStore {
 constructor(filename,DatabaseSync){
  mkdirSync(dirname(filename),{recursive:true});this.db=new DatabaseSync(filename);this.queue=Promise.resolve();this.kind='sqlite';
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS world (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS accounts (username TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS action_receipts(actor_id TEXT NOT NULL,nonce TEXT NOT NULL,action_type TEXT NOT NULL,PRIMARY KEY(actor_id,nonce)); CREATE TABLE IF NOT EXISTS request_limits(key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,count INTEGER NOT NULL);');
  this.db.prepare('INSERT OR IGNORE INTO world(id,data) VALUES(1,?)').run(JSON.stringify(createWorld()));
 }
 async ping(){this.db.prepare('SELECT 1').get();return true;}
 async getAccountById(id){const row=this.db.prepare('SELECT data FROM accounts WHERE id=?').get(id);return row?JSON.parse(row.data):null;}
 async updateAccount(account){this.db.prepare('UPDATE accounts SET data=? WHERE id=?').run(JSON.stringify(account),account.id);}
 async deleteAccountSessions(id){this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(id);}
 async getAccount(username){const row=this.db.prepare('SELECT data FROM accounts WHERE username=?').get(username);return row?JSON.parse(row.data):null;}
 async createAccount(account){try{this.db.prepare('INSERT INTO accounts(username,id,data) VALUES(?,?,?)').run(account.username,account.id,JSON.stringify(account));return true;}catch(error){if(error.code?.startsWith('ERR_SQLITE')&&String(error.message).includes('UNIQUE'))return false;throw error;}}
 async createSession(hash,accountId,expires){this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());this.db.prepare('INSERT INTO sessions(token_hash,account_id,expires) VALUES(?,?,?)').run(hash,accountId,expires);}
 async getSession(hash){const row=this.db.prepare('SELECT account_id,expires FROM sessions WHERE token_hash=?').get(hash);return row&&row.expires>Date.now()?row.account_id:null;}
 async deleteSession(hash){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash);}
 async consumeQuota(key,limit,windowMs){const start=Math.floor(Date.now()/windowMs)*windowMs;const row=this.db.prepare('INSERT INTO request_limits(key,window_start,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=CASE WHEN request_limits.window_start=excluded.window_start THEN request_limits.count+1 ELSE 1 END RETURNING count').get(key,start);return row.count<=limit;}
 async updateWorld(mutator,{actorId,actionId,type,onDuplicate}={}){
  const work=()=>{this.db.exec('BEGIN IMMEDIATE');try{const world=JSON.parse(this.db.prepare('SELECT data FROM world WHERE id=1').get().data);if(actorId&&actionId&&this.db.prepare('SELECT 1 FROM action_receipts WHERE actor_id=? AND nonce=?').get(actorId,actionId)){const output=onDuplicate(world);this.db.exec('COMMIT');return output;}const result=mutator(world);if(actorId&&actionId)this.db.prepare('INSERT INTO action_receipts(actor_id,nonce,action_type) VALUES(?,?,?)').run(actorId,actionId,type);this.db.prepare('UPDATE world SET data=? WHERE id=1').run(JSON.stringify(world));this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}};
  const result=this.queue.then(work,work);this.queue=result.catch(()=>{});return result;
 }
 close(){this.db.close();}
}
