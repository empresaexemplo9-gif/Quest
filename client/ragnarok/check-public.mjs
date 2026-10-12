// Real temporary-account login over the selected server's native HTTPS/WSS gateway.
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
const address = new URL(process.argv[2]);
if (address.protocol !== 'https:' || address.username || address.password || address.pathname !== '/' || address.search || address.hash) throw new Error('A trusted HTTPS server origin is required');
const userid = 'probe_' + randomBytes(6).toString('hex');
const password = randomBytes(12).toString('hex');
const packet = Buffer.alloc(55);
packet.writeUInt16LE(0x64);packet.writeUInt32LE(20211103,2);
packet.write(userid+'_M',6,24);packet.write(password,30,24);
let accountId = null;
try {
  await new Promise((resolve,reject)=>{
    const ws = new WebSocket(address.origin.replace(/^https:/,'wss:')+'/127.0.0.1:6900',{origin:address.origin});
    let data=Buffer.alloc(0);
    const timer=setTimeout(()=>{ws.terminate();reject(new Error('Native WSS login timed out'));},20000);
    const fail=error=>{clearTimeout(timer);ws.terminate();reject(error);};
    ws.on('error',fail);
    ws.on('open',()=>ws.send(packet,{binary:true}));
    ws.on('message',chunk=>{
      data=Buffer.concat([data,chunk]);
      if(data.length<4)return;
      if(data.readUInt16LE(0)!==0xac4){fail(new Error('Native account login rejected'));return;}
      if(data.length<data.readUInt16LE(2))return;
      accountId=data.readUInt32LE(8);
      if(accountId<=1||!data.includes(Buffer.from('Quest'))){fail(new Error('Native character server missing'));return;}
      clearTimeout(timer);ws.close();resolve();
    });
  });
  console.log(JSON.stringify({ready:true,accountId,userid}));
} catch(error) {
  console.log(JSON.stringify({ready:false,accountId,userid,message:error.message}));
  process.exitCode=1;
}
