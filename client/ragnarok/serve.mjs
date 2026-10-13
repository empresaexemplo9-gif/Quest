import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile, realpath} from 'node:fs/promises';
import {WebSocketServer, WebSocket} from 'ws';
import {createNativeAccountHandler} from './accounts.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(project, '.local/ragnarok/vendor/roBrowserLegacy/dist/Web');
const cityData = path.join(project,'content/eridan/data');
const localeRoot = path.join(project,'content/ragnarok');
const port = Number(process.env.QUEST_RO_PORT || 3005);
const origin = `http://127.0.0.1:${port}`;
const publicURL = new URL(process.env.QUEST_RO_PUBLIC_URL || origin);
if (!['http:', 'https:'].includes(publicURL.protocol) || publicURL.username || publicURL.password || publicURL.pathname !== '/') throw new Error('Invalid public client URL');
const allowedOrigins = new Set((process.env.QUEST_RO_ALLOWED_ORIGINS || origin).split(',').map(value => new URL(value.trim()).origin));
const connectionCounts = new Map();
const attempts = new Map();
setInterval(() => {
  for (const [ip,value] of attempts) if (Date.now() - value.started >= 60000) attempts.delete(ip);
},30000).unref();
const targets = new Set(['127.0.0.1:6900', '127.0.0.1:6121', '127.0.0.1:5121']);
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.css':'text/css', '.wasm':'application/wasm'};
const accountHandler = createNativeAccountHandler({origins:allowedOrigins,clientIP:request => process.env.QUEST_RO_TRUST_PROXY === '1' ? (request.headers['cf-connecting-ip'] || request.socket.remoteAddress) : request.socket.remoteAddress});

const server = http.createServer(async (request, response) => {
  if (new URL(request.url,origin).pathname === '/api/account') {await accountHandler(request,response); return;}
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405); response.end(); return;
  }
  try {
    const url = new URL(request.url, origin);
    if (url.pathname === '/Config.js') {
      const config = {development:false, quality:150, remoteClient:publicURL.origin + '/remote-client/', skipIntro:true, skipServerList:true, clientVersionMode:'PacketVer', calculateHash:false, packetDump:false, BGMFileExtension:['mp3'], servers:[{display:'Quest - Cinzas de Eridan', address:'127.0.0.1', port:6900, version:55, langtype:1, packetver:20211103, renewal:true, packetKeys:false, forceUseAddress:true, remoteClient:publicURL.origin+'/remote-client/', socketProxy:publicURL.origin.replace(/^http/, 'ws')}]};
      response.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8', 'Cache-Control':'no-store'});
      response.end('window.ROConfigBase = ' + JSON.stringify(config) + ';'); return;
    }
    if (url.pathname === '/quest-login.js') {
      const bridge = await readFile(new URL('./portal-login.js',import.meta.url),'utf8');
      response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
      response.end('window.QUEST_PORTAL_ORIGINS = ' + JSON.stringify([...allowedOrigins]) + ';\n' + bridge); return;
    }
    if (url.pathname.startsWith('/remote-client/')) {
      const localPath=decodeURIComponent(url.pathname.slice('/remote-client/'.length)).replace(/\\/g,'/');
      if (/^(data|System)\//i.test(localPath)) {
        let localized=null;
        try {const resolved=await realpath(path.join(localeRoot,localPath));if(resolved.startsWith(localeRoot+path.sep))localized=await readFile(resolved);}catch {}
        if(localized){response.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(request.method==='HEAD'?undefined:localized);return;}
      }
      const cityPath = decodeURIComponent(url.pathname.slice('/remote-client/data/'.length)).replace(/\\/g,'/');
      if (url.pathname.startsWith('/remote-client/data/')) {
        let custom = null;
        try {const resolved = await realpath(path.join(cityData,cityPath)); if(resolved.startsWith(cityData+path.sep))custom=await readFile(resolved);} catch {}
        if(custom){response.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(request.method==='HEAD'?undefined:custom);return;}
      }
      const upstream = await fetch('http://127.0.0.1:3338' + url.pathname.slice('/remote-client'.length) + url.search);
      response.writeHead(upstream.status, {'Content-Type':upstream.headers.get('content-type') || 'application/octet-stream', 'X-Content-Type-Options':'nosniff'});
      response.end(request.method === 'HEAD' ? undefined : Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    if(url.pathname.startsWith('/quest-art/')){
      const artRoot=path.join(project,'public/art/ragnarok');
      const filename=await realpath(path.join(artRoot,decodeURIComponent(url.pathname.slice('/quest-art/'.length))));
      if(!filename.startsWith(artRoot+path.sep))throw Error('Outside Quest artwork');
      const content=await readFile(filename);response.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(request.method==='HEAD'?undefined:content);return;
    }
    if (url.pathname === '/api/readiness') {
      let assetsReady = false;
      try {
        const check = await fetch('http://127.0.0.1:3338/data/prontera.gat');
        const bytes = Buffer.from(await check.arrayBuffer());
        assetsReady = check.ok && bytes.subarray(0,4).toString() === 'GRAT';
      } catch {}
      const portsReady = (await Promise.all([6900,6121,5121].map(tcpPort => new Promise(resolve => {
        const socket = net.createConnection({host:'127.0.0.1', port:tcpPort});
        const finish = ok => {socket.destroy(); resolve(ok);};
        socket.setTimeout(1500, () => finish(false)); socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
      })))).every(Boolean);
      let handshakeReady = true;
      if (process.env.QUEST_RO_REQUIRE_HANDSHAKE) {
        try {
          const status = JSON.parse(await readFile(process.env.QUEST_RO_REQUIRE_HANDSHAKE, 'utf8'));
          handshakeReady = status.char === true && status.map === true;
        } catch {handshakeReady = false;}
      }
      const nativeReady = portsReady && handshakeReady;
      response.writeHead(assetsReady && nativeReady ? 200 : 503, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
      response.end(JSON.stringify({engine:'rAthena', renderer:'roBrowserLegacy', packetver:20211103, renewal:true, assetsReady, nativeReady, reason:!assetsReady ? 'KRO_ASSET_SERVICE_NOT_READY' : !nativeReady ? 'NATIVE_SERVERS_NOT_READY' : null}));
      return;
    }
    const filename = await realpath(path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!filename.startsWith(root + path.sep)) throw new Error('Outside web root');
    let content = await readFile(filename);
    if (filename === path.join(root,'index.html')) content = content.toString('utf8').replace('</head>','<script src="/quest-login.js" defer></script></head>');
    response.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});

const sockets = new WebSocketServer({noServer:true, maxPayload:65536, perMessageDeflate:false});
server.on('upgrade', (request, socket, head) => {
  const target = request.url.slice(1);
  if (!allowedOrigins.has(request.headers.origin) || !targets.has(target) || sockets.clients.size >= 128) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
  }
  // Caddy replaces X-Forwarded-For; only trust it in the private production network.
  const clientIP = process.env.QUEST_RO_TRUST_PROXY === '1' ? String(request.headers['x-forwarded-for'] || request.socket.remoteAddress).split(',')[0].trim() : request.socket.remoteAddress;
  let attempt = attempts.get(clientIP);
  if (!attempt || Date.now() - attempt.started >= 60000) attempt = {started:Date.now(),count:0};
  if ((connectionCounts.get(clientIP) || 0) >= 8 || attempt.count >= 24 || (!attempts.has(clientIP) && attempts.size >= 10000)) {
    socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); return;
  }
  attempt.count++; attempts.set(clientIP,attempt);
  sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, target, clientIP));
});
sockets.on('connection', (ws, target, clientIP) => {
  connectionCounts.set(clientIP,(connectionCounts.get(clientIP) || 0)+1);
  ws.once('close', () => {
    const count = (connectionCounts.get(clientIP) || 1)-1;
    if(count)connectionCounts.set(clientIP,count);else connectionCounts.delete(clientIP);
  });
  const [host, tcpPort] = target.split(':');
  const tcp = net.createConnection({host, port:Number(tcpPort)});
  tcp.setNoDelay(true);
  const close = () => {tcp.destroy(); if (ws.readyState === WebSocket.OPEN) ws.close();};
  ws.on('message', (data, binary) => {
    if (!binary || tcp.destroyed) {close(); return;}
    if (!tcp.write(data)) ws.pause();
  });
  tcp.on('drain', () => ws.resume());
  tcp.on('data', data => {if (ws.readyState === WebSocket.OPEN) ws.send(data, {binary:true}, error => {if(error)close();});});
  tcp.on('error', close); tcp.on('close', close);
  ws.on('error', close); ws.on('close', close);
});

server.listen(port, process.env.QUEST_RO_BIND || '127.0.0.1', () => console.log(`Quest Ragnarok client listening on port ${port}.`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {
  for (const ws of sockets.clients) ws.terminate();
  server.close(() => process.exit(0));
});
