import {readFile} from 'node:fs/promises';
import {createWorld} from '../public/game/core.js';

const json=value=>JSON.stringify(value);
const statements=new URL('./migrations/001_initial.sql',import.meta.url);

export class PostgresStore {
 static async open(connectionString){
  const url=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  const {Pool}=await import('pg');
  const local=['postgres','localhost','127.0.0.1','::1'].includes(url.hostname);
  // TLS verification stays enabled for external databases.
  if(!local)url.searchParams.delete('sslmode');
  const pool=new Pool({connectionString:url.toString(),max:process.env.VERCEL?2:8,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,...(!local?{ssl:{rejectUnauthorized:true}}:{})});
  pool.on('error',()=>console.error('PostgreSQL connection interrupted; the pool will reconnect.'));
  const store=new PostgresStore(pool);
  try{
   await pool.query(await readFile(statements,'utf8'));
   await pool.query('INSERT INTO game_world(id,state) VALUES(1,$1::jsonb) ON CONFLICT DO NOTHING',[json(createWorld())]);
   const {rows}=await pool.query('SELECT state FROM game_world WHERE id=1');
   for(const guild of Object.values(rows[0].state.guilds))await pool.query('INSERT INTO guilds(id,name,leader_id,specialization,data) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING',[guild.id,guild.name,guild.leader,guild.specialization,json(guild)]);
   await store.ping();return store;
  }catch(error){await pool.end();throw error;}
 }
 constructor(pool){this.pool=pool;this.kind='postgres';}
 async ping(){await this.pool.query('SELECT 1');return true;}
 async getAccount(username){const {rows}=await this.pool.query('SELECT data FROM accounts WHERE username=$1',[username]);return rows[0]?.data||null;}
 async getAccountById(id){const {rows}=await this.pool.query('SELECT data FROM accounts WHERE id=$1',[id]);return rows[0]?.data||null;}
 async createAccount(account){const result=await this.pool.query('INSERT INTO accounts(id,username,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(username) DO NOTHING RETURNING id',[account.id,account.username,json(account)]);return result.rowCount===1;}
 async createSession(hash,accountId,expires){await this.pool.query('DELETE FROM sessions WHERE expires<$1',[Date.now()]);await this.pool.query('INSERT INTO sessions(token_hash,account_id,expires) VALUES($1,$2,$3)',[hash,accountId,expires]);}
 async getSession(hash){const {rows}=await this.pool.query('SELECT account_id FROM sessions WHERE token_hash=$1 AND expires>$2',[hash,Date.now()]);return rows[0]?.account_id||null;}
 async deleteSession(hash){await this.pool.query('DELETE FROM sessions WHERE token_hash=$1',[hash]);}
 async deleteAccountSessions(id){await this.pool.query('DELETE FROM sessions WHERE account_id=$1',[id]);}
 async updateAccount(account){await this.pool.query('UPDATE accounts SET data=$2::jsonb WHERE id=$1',[account.id,json(account)]);}
 async consumeQuota(key,limit,windowMs){const start=Math.floor(Date.now()/windowMs)*windowMs;const {rows}=await this.pool.query('INSERT INTO request_limits(key,window_start,count) VALUES($1,$2,1) ON CONFLICT(key) DO UPDATE SET window_start=EXCLUDED.window_start,count=CASE WHEN request_limits.window_start=EXCLUDED.window_start THEN request_limits.count+1 ELSE 1 END RETURNING count',[key,start]);return rows[0].count<=limit;}
 async updateWorld(mutator,{actorId,actionId,type,onDuplicate,prepareTransaction}={}){
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const {rows}=await client.query('SELECT state FROM game_world WHERE id=1 FOR UPDATE');const world=rows[0].state;
   if(actorId&&actionId){const receipt=await client.query('SELECT 1 FROM action_receipts WHERE actor_id=$1 AND nonce=$2',[actorId,actionId]);if(receipt.rowCount){const output=onDuplicate(world);await client.query('COMMIT');return output;}}
   if(prepareTransaction)await prepareTransaction(client,world);
   const previousPlayers=Object.fromEntries(Object.entries(world.players).map(([id,p])=>[id,json(p)]));
   const previousGuilds=Object.fromEntries(Object.entries(world.guilds).map(([id,g])=>[id,json(g)]));
   const oldListings=json(world.listings);
   const beforeCredits=Object.fromEntries(Object.entries(world.players).map(([id,p])=>[id,p.credits]));
   const result=await mutator(world);
   await client.query('UPDATE game_world SET state=$1::jsonb,revision=$2,updated_at=now() WHERE id=1',[json(world),world.revision]);
   for(const guild of Object.values(world.guilds))if(json(guild)!==previousGuilds[guild.id])await client.query('INSERT INTO guilds(id,name,leader_id,specialization,data) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,leader_id=EXCLUDED.leader_id,specialization=EXCLUDED.specialization,data=EXCLUDED.data,updated_at=now()',[guild.id,guild.name,guild.leader,guild.specialization,json(guild)]);
   for(const p of Object.values(world.players)){
    if(json(p)===previousPlayers[p.id])continue;
    await client.query('INSERT INTO characters(id,name,class_id,level,xp,credits,guild_id,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,class_id=EXCLUDED.class_id,level=EXCLUDED.level,xp=EXCLUDED.xp,credits=EXCLUDED.credits,guild_id=EXCLUDED.guild_id,data=EXCLUDED.data,updated_at=now()',[p.id,p.name,p.classId,p.level,p.xp,p.credits,p.guildId,json(p)]);
    await client.query('DELETE FROM inventory WHERE character_id=$1',[p.id]);
    for(const [item,quantity]of Object.entries(p.inventory))await client.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3)',[p.id,item,quantity]);
   }
   for(const guild of Object.values(world.guilds))if(json(guild)!==previousGuilds[guild.id]){
    await client.query('DELETE FROM guild_members WHERE guild_id=$1',[guild.id]);
    for(const member of Object.keys(guild.members))await client.query('INSERT INTO guild_members(guild_id,character_id,role) VALUES($1,$2,$3)',[guild.id,member,guild.roles[member]]);
   }
   if(oldListings!==json(world.listings)){
    await client.query('DELETE FROM market_listings');
    for(const l of world.listings)await client.query('INSERT INTO market_listings(id,seller_id,quantity,price,data) VALUES($1,$2,$3,$4,$5::jsonb)',[l.id,l.seller,l.quantity,l.price,json(l)]);
   }
   if(actorId&&actionId)await client.query('INSERT INTO action_receipts(actor_id,nonce,action_type) VALUES($1,$2,$3)',[actorId,actionId,type]);
   if(actorId&&type&&!['move','heartbeat','chat'].includes(type)){
    const changes=Object.values(world.players).filter(p=>p.credits!==beforeCredits[p.id]).map(p=>({characterId:p.id,creditsDelta:p.credits-(beforeCredits[p.id]||0)}));
    await client.query('INSERT INTO game_audit(actor_id,action_type,data) VALUES($1,$2,$3::jsonb)',[actorId,type,json({revision:world.revision,changes})]);
   }
   await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async close(){await this.pool.end();}
}
