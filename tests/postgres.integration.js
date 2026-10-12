import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {startServer} from '../server/index.js';

test('Real PostgreSQL: accounts, inventory, guilds, atomic trade, durable replay protection and restart',async()=>{
 const connection=process.env.QUEST_TEST_DATABASE_URL||process.env.DATABASE_URL;
 assert.ok(connection,'A real test PostgreSQL connection is required.');
 const pool=new pg.Pool({connectionString:connection}),schema='quest_verification_'+randomBytes(6).toString('hex');
 let app;
 try{
  await pool.query('CREATE SCHEMA '+schema);
  const url=new URL(connection);url.searchParams.set('options','-c search_path='+schema+',public');
  app=await startServer({port:0,databaseUrl:url.toString()});let origin='http://127.0.0.1:'+app.port;
  const request=async(operation,body={},cookie='')=>{
   const method=['state','profile','health'].includes(operation)?'GET':'POST';
   const response=await fetch(origin+(operation==='health'?'/api/health':'/api/game?action='+operation),{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});
   return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const health=await request('health');assert.equal(health.status,200);assert.equal(health.data.database,'postgres');
  const a=await request('register',{username:'ari',password:'test-password-a',name:'Ari',classId:'warrior'}),b=await request('register',{username:'nyra',password:'test-password-b',name:'Nyra',classId:'lumen'});
  assert.equal(a.status,200);assert.equal(b.status,200);assert.ok(b.data.players.some(p=>p.id===a.data.player.id));
  const profile=await request('profile',{},a.cookie);assert.equal(profile.data.username,'ari');assert.equal(JSON.stringify(profile.data).includes('passwordHash'),false);
  const action=(id,type,args={})=>({action:{id,type,args}});
  assert.equal((await request('action',action('guild-001','joinGuild',{guildId:'chama'}),a.cookie)).status,200);
  const sale=await request('action',action('sale-001','listItem',{itemId:'potion',quantity:1,price:20}),a.cookie);const listing=sale.data.listings[0];
  const purchases=await Promise.all(['buy-001','buy-002'].map(id=>request('action',action(id,'buyItem',{listingId:listing.id}),b.cookie)));
  assert.deepEqual(purchases.map(r=>r.status).sort(),[200,400]);
  assert.equal((await request('state',{},b.cookie)).data.player.inventory.potion,4);
  const client=await app.store.pool.connect();
  try{
   for(const [table,minimum]of [['accounts',2],['characters',2],['inventory',4],['guild_members',1],['action_receipts',3],['game_audit',3]]){const result=await client.query('SELECT count(*) FROM '+table);assert.ok(Number(result.rows[0].count)>=minimum,table);}
   assert.equal((await client.query('SELECT count(*) FROM market_listings')).rows[0].count,'0');
  }finally{client.release();}
  // Clear the engine's short replay window; SQL receipt must still prevent repetition.
  await app.store.updateWorld(world=>{world.players[a.data.player.id].processed=[];});
  assert.equal((await request('action',action('sale-001','listItem',{itemId:'potion',quantity:1,price:20}),a.cookie)).data.listings.length,0);
  await app.close();app=await startServer({port:0,databaseUrl:url.toString()});origin='http://127.0.0.1:'+app.port;
  const restored=await request('state',{},b.cookie);assert.equal(restored.status,200);assert.equal(restored.data.player.credits,20);assert.equal(restored.data.player.inventory.potion,4);
  const changed=await request('changePassword',{currentPassword:'test-password-b',newPassword:'new-test-password-b'},b.cookie);assert.equal(changed.status,200);
  assert.equal((await request('state',{},b.cookie)).status,401);
  assert.equal((await request('login',{username:'nyra',password:'test-password-b'})).status,401);
  assert.equal((await request('login',{username:'nyra',password:'new-test-password-b'})).status,200);
  const quota=await Promise.all(Array.from({length:4},()=>app.store.consumeQuota('integration-limit',3,60000)));assert.deepEqual(quota.sort(),[false,true,true,true]);
 }finally{
  if(app)await app.close();await pool.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await pool.end();
 }
});
