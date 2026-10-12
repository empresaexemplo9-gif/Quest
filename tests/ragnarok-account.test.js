import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {accountInput,accountBody,nativeAccount,createNativeAccountHandler,AccountError} from '../client/ragnarok/accounts.mjs';
import {createPortalAccountHandler} from '../server/ragnarok-account.js';

// Fictitious credentials used only by isolated test servers.
const input = {action:'register',username:'FixtureUser',password:'FixturePass123',gender:'F'};
const origin = 'https://quest.example';
function request(body = input, headers = {}) {return {method:'POST',body,headers:{host:'quest.example',origin,'content-type':'application/json',...headers}};}
function response() {return {writeHead(status,headers) {this.status = status; this.headers = headers;},end(body) {this.body = JSON.parse(body);}};}
async function withNative(handler,action) {
  const server = net.createServer(socket => socket.once('data',data => handler(socket,data)));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {await action(server.address().port);} finally {await new Promise(resolve => server.close(resolve));}
}

test('account input respects native field sizes and blocks registration suffixes on ordinary login',() => {
  assert.equal(accountInput(input).username,input.username);
  for (const patch of [{username:'ab'},{username:'u'.repeat(22)},{username:'name_M'},{username:'name_f'},{username:'name\u0000x'},{password:'short'},{password:'p'.repeat(24)},{password:'has spaces here'},{password:'acentuação123'},{gender:'S'},{action:'delete'}]) assert.throws(() => accountInput({...input,...patch}),AccountError);
});

test('account body rejects non-JSON, malformed JSON and oversized parsed bodies',async () => {
  await assert.rejects(accountBody(request(input,{'content-type':'text/plain'})),{status:415});
  await assert.rejects(accountBody(request('{broken')),{status:400});
  await assert.rejects(accountBody(request({...input,extra:'x'.repeat(5000)})),{status:413});
});

test('registration uses the native packet and handles fragmented successful replies without returning secrets',async () => {
  await withNative((socket,packet) => {
    assert.equal(packet.readUInt16LE(0),0x64); assert.equal(packet.readUInt32LE(2),20211103);
    assert.equal(packet.subarray(6,30).toString().split('\0')[0],'FixtureUser_F');
    const accepted = Buffer.alloc(80); accepted.writeUInt16LE(0xac4); accepted.writeUInt16LE(80,2); accepted.writeUInt32LE(2000001,8); accepted.write('Quest',50);
    socket.write(accepted.subarray(0,3)); setTimeout(() => socket.write(accepted.subarray(3)),5);
  },async port => {
    const result = await nativeAccount(input,{port});
    assert.deepEqual(result,{ok:true,action:'register',username:input.username});
    assert.ok(!JSON.stringify(result).includes(input.password));
  });
});

test('existing username and incorrect password have distinct native responses',async () => {
  await withNative(socket => {const packet=Buffer.alloc(26); packet.writeUInt16LE(0x83e); packet.writeUInt32LE(1,2); socket.end(packet);},async port => {
    await assert.rejects(nativeAccount(input,{port}),{status:409,code:'USERNAME_TAKEN'});
    await assert.rejects(nativeAccount({...input,action:'login'},{port}),{status:401,code:'INVALID_CREDENTIALS'});
  });
});

test('native timeouts and malformed acceptance packets cannot report success',async () => {
  await withNative(() => {},async port => {await assert.rejects(nativeAccount(input,{port,timeout:30}),{status:503});});
  await withNative(socket => socket.end(Buffer.from([0xc4,0x0a,0x01,0x00])),async port => {await assert.rejects(nativeAccount(input,{port}),{status:503});});
});

test('native HTTP handler enforces origin and a bounded attempt rate',async () => {
  let calls=0;
  const handler=createNativeAccountHandler({origins:new Set([origin]),authenticate:async value => {calls++;return {ok:true,action:value.action,username:value.username};},clientIP:() => 'fixture-client'});
  const denied=response(); await handler(request(input,{origin:'https://other.example'}),denied); assert.equal(denied.status,403); assert.equal(calls,0);
  for(let i=0;i<20;i++){const res=response();await handler(request(),res);assert.equal(res.status,201);}
  const limited=response(); await handler(request(),limited); assert.equal(limited.status,429); assert.equal(calls,20);
});

test('portal forwards only validated account data to the configured native HTTPS origin',async () => {
  let captured;
  const handler=createPortalAccountHandler({manifest:() => ({server:'https://native.example'}),request:async (url,options) => {captured={url,options};return {ok:true,status:201,json:async () => ({ok:true,action:input.action,username:input.username,password:'must-not-be-forwarded'})};}});
  const res=response(); await handler(request(),res);
  assert.equal(captured.url,'https://native.example/api/account'); assert.equal(captured.options.redirect,'error'); assert.equal(captured.options.headers.Origin,origin);
  assert.equal(res.status,201); assert.deepEqual(res.body,{ok:true,username:input.username,action:'register',server:'https://native.example'});
  assert.equal(res.headers['Cache-Control'],'no-store');
});

test('portal blocks foreign origins, private upstreams and hides upstream errors',async () => {
  let calls=0; const network=async () => {calls++;throw Error('private-password');};
  const valid=createPortalAccountHandler({manifest:() => ({server:'https://native.example'}),request:network});
  const denied=response();await valid(request(input,{origin:'https://other.example'}),denied);assert.equal(denied.status,403);assert.equal(calls,0);
  const privateHandler=createPortalAccountHandler({manifest:() => ({server:'https://127.0.0.1'}),request:network});
  const unavailable=response();await privateHandler(request(),unavailable);assert.equal(unavailable.status,503);assert.equal(calls,0);
  const failed=response();await valid(request(),failed);assert.deepEqual(failed.body,{error:'SERVER_UNAVAILABLE'});
});

test('a real HTTP request reaches account validation and returns a usable JSON result',async () => {
  const handler=createNativeAccountHandler({origins:new Set([origin]),authenticate:async value => ({ok:true,action:value.action,username:value.username})});
  const server=http.createServer(handler); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/account',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
    assert.equal(res.status,201);assert.deepEqual(await res.json(),{ok:true,action:'register',username:input.username});
  } finally {await new Promise(resolve => server.close(resolve));}
});
