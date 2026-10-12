import net from 'node:net';

export class AccountError extends Error {
  constructor(status, code) {super(code); this.status = status; this.code = code;}
}

export function accountInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !['register','login'].includes(value.action)) throw new AccountError(400,'INVALID_REQUEST');
  const {action, username, password, gender = 'M'} = value;
  if (typeof username !== 'string' || !/^[A-Za-z0-9_]{4,21}$/.test(username) || /_[MF]$/i.test(username)) throw new AccountError(400,'INVALID_USERNAME');
  if (typeof password !== 'string' || !/^[!-~]{8,23}$/.test(password)) throw new AccountError(400,'INVALID_PASSWORD');
  if (action === 'register' && !['M','F'].includes(gender)) throw new AccountError(400,'INVALID_GENDER');
  return {action, username, password, gender};
}

export async function accountBody(req) {
  if (String(req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') throw new AccountError(415,'JSON_REQUIRED');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > 4096) throw new AccountError(413,'REQUEST_TOO_LARGE');
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 4096) throw new AccountError(413,'REQUEST_TOO_LARGE');
    try {body = JSON.parse(body);} catch {throw new AccountError(400,'INVALID_REQUEST');}
  } else if (Buffer.byteLength(JSON.stringify(body) || '') > 4096) throw new AccountError(413,'REQUEST_TOO_LARGE');
  return accountInput(body);
}

// Use the engine's own registration/authentication protocol and account database.
export function nativeAccount(input, {host = '127.0.0.1', port = 6900, timeout = 10000} = {}) {
  input = accountInput(input);
  return new Promise((resolve,reject) => {
    const packet = Buffer.alloc(55);
    packet.writeUInt16LE(0x64); packet.writeUInt32LE(20211103,2);
    packet.write(input.username + (input.action === 'register' ? '_' + input.gender : ''),6,24,'ascii');
    packet.write(input.password,30,24,'ascii'); packet[54] = 1;
    const socket = net.createConnection({host,port});
    let data = Buffer.alloc(0), finished = false;
    const finish = (error,result) => {
      if (finished) return; finished = true; clearTimeout(timer); packet.fill(0); socket.destroy();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new AccountError(503,'SERVER_UNAVAILABLE')),timeout);
    socket.once('connect',() => socket.write(packet));
    socket.once('error',() => finish(new AccountError(503,'SERVER_UNAVAILABLE')));
    socket.once('close',() => {if (!finished) finish(new AccountError(503,'SERVER_UNAVAILABLE'));});
    socket.on('data',chunk => {
      data = Buffer.concat([data,chunk]);
      if (data.length > 65536) {finish(new AccountError(503,'SERVER_UNAVAILABLE')); return;}
      if (data.length < 2) return;
      const type = data.readUInt16LE(0);
      if (type === 0xac4) {
        if (data.length < 4) return;
        const length = data.readUInt16LE(2);
        if (length < 64 || length > 65536) {finish(new AccountError(503,'SERVER_UNAVAILABLE')); return;}
        if (data.length < length) return;
        if (data.readUInt32LE(8) <= 1 || !data.subarray(0,length).includes(Buffer.from('Quest'))) {finish(new AccountError(503,'SERVER_UNAVAILABLE')); return;}
        finish(null,{ok:true, action:input.action, username:input.username});
      } else if (type === 0x83e || type === 0x6a) {
        if (data.length < (type === 0x83e ? 6 : 3)) return;
        const reason = type === 0x83e ? data.readUInt32LE(2) : data[2];
        if (input.action === 'register' && reason === 1) finish(new AccountError(409,'USERNAME_TAKEN'));
        else if (reason === 0 || reason === 1) finish(new AccountError(401,'INVALID_CREDENTIALS'));
        else if (input.action === 'register' && reason === 3) finish(new AccountError(429,'TRY_LATER'));
        else finish(new AccountError(403,'ACCOUNT_UNAVAILABLE'));
      } else if (type === 0x81) {
        if (data.length < 3) return;
        finish(new AccountError(409,data[2] === 8 || data[2] === 2 ? 'ALREADY_ONLINE' : 'SERVER_UNAVAILABLE'));
      } else finish(new AccountError(503,'SERVER_UNAVAILABLE'));
    });
  });
}

export function accountReply(res,status,body) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(body));
}

export function createNativeAccountHandler({origins, authenticate = nativeAccount, clientIP = req => req.socket.remoteAddress} = {}) {
  const attempts = new Map();
  return async (req,res) => {
    if (req.method !== 'POST') {accountReply(res,405,{error:'METHOD_NOT_ALLOWED'}); return;}
    if (!origins.has(req.headers.origin)) {accountReply(res,403,{error:'ORIGIN_DENIED'}); return;}
    const now = Date.now(), ip = clientIP(req);
    for (const [key,value] of attempts) if (now - value.started > 60000) attempts.delete(key);
    let attempt = attempts.get(ip);
    if (!attempt && attempts.size >= 10000) {accountReply(res,429,{error:'TRY_LATER'}); return;}
    if (!attempt) {attempt = {started:now,count:0}; attempts.set(ip,attempt);}
    if (++attempt.count > 20) {accountReply(res,429,{error:'TRY_LATER'}); return;}
    try {
      const input = await accountBody(req);
      const result = await authenticate(input);
      accountReply(res,input.action === 'register' ? 201 : 200,result);
    } catch (error) {accountReply(res,error instanceof AccountError ? error.status : 503,{error:error instanceof AccountError ? error.code : 'SERVER_UNAVAILABLE'});}
  };
}
