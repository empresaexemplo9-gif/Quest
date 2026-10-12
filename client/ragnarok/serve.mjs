import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile, realpath} from 'node:fs/promises';
import {WebSocketServer, WebSocket} from 'ws';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(project, '.local/ragnarok/vendor/roBrowserLegacy/dist/Web');
const port = Number(process.env.QUEST_RO_PORT || 3005);
const origin = `http://127.0.0.1:${port}`;
const targets = new Set(['127.0.0.1:6900', '127.0.0.1:6121', '127.0.0.1:5121']);
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.css':'text/css', '.wasm':'application/wasm'};

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405); response.end(); return;
  }
  try {
    const url = new URL(request.url, origin);
    if (url.pathname.startsWith('/remote-client/')) {
      const upstream = await fetch('http://127.0.0.1:3338' + url.pathname.slice('/remote-client'.length) + url.search);
      response.writeHead(upstream.status, {'Content-Type':upstream.headers.get('content-type') || 'application/octet-stream', 'X-Content-Type-Options':'nosniff'});
      response.end(request.method === 'HEAD' ? undefined : Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    if (url.pathname === '/api/readiness') {
      let assetsReady = false;
      try {
        const check = await fetch('http://127.0.0.1:3338/data/prontera.gat');
        const bytes = Buffer.from(await check.arrayBuffer());
        assetsReady = check.ok && bytes.subarray(0,4).toString() === 'GRAT';
      } catch {}
      response.writeHead(assetsReady ? 200 : 503, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
      response.end(JSON.stringify({engine:'rAthena', renderer:'roBrowserLegacy', packetver:20211103, renewal:true, assetsReady, reason:assetsReady ? null : 'KRO_ASSET_SERVICE_NOT_READY'}));
      return;
    }
    const filename = await realpath(path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!filename.startsWith(root + path.sep)) throw new Error('Outside web root');
    const content = await readFile(filename);
    response.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});

const sockets = new WebSocketServer({noServer:true, maxPayload:65536, perMessageDeflate:false});
server.on('upgrade', (request, socket, head) => {
  const target = request.url.slice(1);
  if (request.headers.origin !== origin || !targets.has(target) || sockets.clients.size >= 128) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
  }
  sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, target));
});
sockets.on('connection', (ws, target) => {
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

server.listen(port, '127.0.0.1', () => console.log(`Quest Ragnarok development client on loopback port ${port}. kRO assets are required.`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {
  for (const ws of sockets.clients) ws.terminate();
  server.close(() => process.exit(0));
});
