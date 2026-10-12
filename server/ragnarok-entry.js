import {readFileSync} from 'node:fs';
import {isIP} from 'node:net';

export function publicNativeOrigin(value) {
  if (typeof value !== 'string' || !value || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port || isIP(url.hostname.replace(/^\[|\]$/g,'')) || !url.hostname.includes('.') || /(^|\.)(localhost|local|internal)$/.test(url.hostname)) return null;
    return url.origin;
  } catch {return null;}
}

export async function nativeEntryStatus(manifest, request = fetch) {
  const server = publicNativeOrigin(manifest.server);
  if (!server) return {connected:false, server:null, reason:'PUBLIC_ENDPOINT_PENDING'};
  try {
    const response = await request(server + '/api/readiness', {signal:AbortSignal.timeout(5000), redirect:'error'});
    const native = response.ok && await response.json();
    if (!native || native.engine !== 'rAthena' || native.renderer !== 'roBrowserLegacy' || native.packetver !== 20211103 || native.nativeReady !== true || native.assetsReady !== true) {
      return {connected:false, server:null, reason:'NATIVE_SERVER_UNAVAILABLE'};
    }
    return {connected:true, server, engine:'rAthena', renderer:'roBrowserLegacy'};
  } catch {return {connected:false, server:null, reason:'NATIVE_SERVER_UNREACHABLE'};}
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','HEAD'].includes(req.method)) {res.status(405).json({error:'METHOD_NOT_ALLOWED'});return;}
  let result;
  try {
    const manifest = JSON.parse(readFileSync(new URL('../public/releases/ragnarok-server.json',import.meta.url),'utf8'));
    result = await nativeEntryStatus(manifest);
  } catch {result = {connected:false, server:null, reason:'PUBLIC_ENDPOINT_PENDING'};}
  res.status(result.connected ? 200 : 503);
  if (req.method === 'HEAD') {res.end();return;}
  res.json(result);
}
