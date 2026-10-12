import {readFileSync} from 'node:fs';
import {publicNativeOrigin} from './ragnarok-entry.js';
import {AccountError,accountBody,accountReply} from '../client/ragnarok/accounts.mjs';

export function createPortalAccountHandler({manifest = () => JSON.parse(readFileSync(new URL('../public/releases/ragnarok-server.json',import.meta.url),'utf8')), request = fetch} = {}) {
  return async (req,res) => {
    if (req.method !== 'POST') {accountReply(res,405,{error:'METHOD_NOT_ALLOWED'}); return;}
    const portal = publicNativeOrigin('https://' + req.headers.host);
    if (!portal || req.headers.origin !== portal) {accountReply(res,403,{error:'ORIGIN_DENIED'}); return;}
    try {
      const input = await accountBody(req);
      const server = publicNativeOrigin(manifest().server);
      if (!server) throw new AccountError(503,'SERVER_UNAVAILABLE');
      const upstream = await request(server + '/api/account',{method:'POST',headers:{'Content-Type':'application/json',Origin:portal},body:JSON.stringify(input),signal:AbortSignal.timeout(15000),redirect:'error'});
      const result = await upstream.json();
      const errors = new Set(['USERNAME_TAKEN','INVALID_CREDENTIALS','TRY_LATER','ACCOUNT_UNAVAILABLE','ALREADY_ONLINE','INVALID_REQUEST','INVALID_USERNAME','INVALID_PASSWORD','INVALID_GENDER','SERVER_UNAVAILABLE']);
      if (upstream.ok && result.ok === true && result.username === input.username && result.action === input.action) {
        accountReply(res,input.action === 'register' ? 201 : 200,{ok:true,username:input.username,action:input.action,server});
      } else {
        const code = errors.has(result.error) ? result.error : 'SERVER_UNAVAILABLE';
        const status = [400,401,403,409,429,503].includes(upstream.status) ? upstream.status : 503;
        accountReply(res,status,{error:code});
      }
    } catch (error) {accountReply(res,error instanceof AccountError ? error.status : 503,{error:error instanceof AccountError ? error.code : 'SERVER_UNAVAILABLE'});}
  };
}

export default createPortalAccountHandler();
