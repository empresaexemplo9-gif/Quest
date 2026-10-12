import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../server/index.js';

test('Two authenticated players share a persistent world, atomic trade, chat and consent',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'eridan-test-')),filename=join(directory,'world.sqlite');let app=await startServer({port:0,filename});let origin='http://127.0.0.1:'+app.port;
 const request=async(action,body={},cookie='')=>{const response=await fetch(origin+'/api/game?action='+action,{method:action==='state'?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(action==='state'?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 try{
  const a=await request('register',{username:'ari',password:'test-password-a',name:'Ari',classId:'warrior'}),b=await request('register',{username:'nyra',password:'test-password-b',name:'Nyra',classId:'lumen'});
  assert.equal(a.status,200);assert.equal(b.status,200);assert.ok(a.cookie&&b.cookie);assert.equal(a.data.player.level,1);assert.ok(b.data.players.some(p=>p.id===a.data.player.id));assert.equal(JSON.stringify(a.data).includes('passwordHash'),false);
  assert.equal((await request('state')).status,401);assert.equal((await request('login',{username:'ari',password:'incorrect'})).status,401);
  const invited=await request('action',{action:{id:'invite-0001',type:'inviteParty',args:{targetId:b.data.player.id}}},a.cookie);assert.equal(invited.status,200);
  const bs=await request('state',{},b.cookie);assert.equal(bs.data.offers.length,1);
  const accepted=await request('action',{action:{id:'accept-0001',type:'offerResponse',args:{offerId:bs.data.offers[0].id,accept:true}}},b.cookie);assert.equal(accepted.status,200);assert.equal(accepted.data.party.members.length,2);
  const chat=await request('action',{action:{id:'chat-0001',type:'chat',args:{text:'A Chama Viva resiste.'}}},a.cookie);assert.equal(chat.status,200);const chatSnapshot=await request('state',{},b.cookie);assert.ok(chatSnapshot.data.events.some(e=>e.type==='chat'&&e.text==='A Chama Viva resiste.'));
  const sale=await request('action',{action:{id:'sale-0001',type:'listItem',args:{itemId:'potion',quantity:1,price:20}}},a.cookie);assert.equal(sale.status,200);const listing=sale.data.listings[0];
  const purchases=await Promise.all([request('action',{action:{id:'buy-0001',type:'buyItem',args:{listingId:listing.id}}},b.cookie),request('action',{action:{id:'buy-0002',type:'buyItem',args:{listingId:listing.id}}},b.cookie)]);assert.deepEqual(purchases.map(v=>v.status).sort(),[200,400]);
  const after=await request('state',{},b.cookie);assert.equal(after.data.player.credits,20);assert.equal(after.data.player.inventory.potion,4);
  await app.close();app=await startServer({port:0,filename});origin='http://127.0.0.1:'+app.port;
  const restored=await request('state',{},b.cookie);assert.equal(restored.status,200);assert.equal(restored.data.player.credits,20);assert.equal(restored.data.player.inventory.potion,4);assert.equal(restored.data.party.members.length,2);
  const wrongOrigin=await fetch(origin+'/api/game?action=state',{headers:{Cookie:a.cookie,Origin:'https://foreign.example.invalid'}});assert.equal(wrongOrigin.status,403);
  const invalid=await request('action',{action:{id:'bad-0001',type:'donate',args:{resource:'energy',amount:-500}}},b.cookie);assert.equal(invalid.status,400);
  await request('logout',{},b.cookie);assert.equal((await request('state',{},b.cookie)).status,401);
 }finally{await app.close();await rm(directory,{recursive:true,force:true});}
});
