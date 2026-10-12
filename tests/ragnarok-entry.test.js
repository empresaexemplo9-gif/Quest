import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeEntryStatus, publicNativeOrigin} from '../server/ragnarok-entry.js';

test('public entry rejects local addresses, credentials and alternate URL parts', () => {
  for (const value of [null,'http://server.example','https://localhost','https://127.0.0.1','https://192.168.0.2','https://[::1]','https://server.local','https://user:password@server.example','https://server.example/game','https://server.example?token=x','https://server.example#x']) assert.equal(publicNativeOrigin(value),null);
  assert.equal(publicNativeOrigin('https://quest.example/'),'https://quest.example');
});

test('unpublished server never advertises a playable world or calls the network', async () => {
  assert.deepEqual(await nativeEntryStatus({server:null},()=>{throw Error('unexpected request');}), {connected:false,server:null,reason:'PUBLIC_ENDPOINT_PENDING'});
});

test('entry requires actual rAthena protocol, maps and native handshakes', async () => {
  const ready = {engine:'rAthena',renderer:'roBrowserLegacy',packetver:20211103,nativeReady:true,assetsReady:true};
  for (const patch of [{engine:'original-client'},{renderer:'image-collage'},{packetver:20200603},{nativeReady:false},{assetsReady:false}]) {
    const result = await nativeEntryStatus({server:'https://quest.example'},async ()=>({ok:true,json:async ()=>({...ready,...patch})}));
    assert.equal(result.connected,false);
    assert.equal(result.server,null);
  }
  let requested;
  const result = await nativeEntryStatus({server:'https://quest.example'},async (url,options)=>{requested={url,options};return {ok:true,json:async ()=>ready};});
  assert.equal(result.connected,true);
  assert.equal(result.server,'https://quest.example');
  assert.equal(requested.url,'https://quest.example/api/readiness');
  assert.equal(requested.options.redirect,'error');
});

test('failed native service reports unavailable without exposing upstream details', async () => {
  const result = await nativeEntryStatus({server:'https://quest.example'},async ()=>{throw Error('private address / credential');});
  assert.deepEqual(result,{connected:false,server:null,reason:'NATIVE_SERVER_UNREACHABLE'});
});
