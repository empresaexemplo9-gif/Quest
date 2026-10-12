#!/usr/bin/env python3
"""Verify trusted HTTPS/WSS login and restart persistence in the native deployment."""
import argparse
import json
from pathlib import Path
import secrets
import ssl
import subprocess
import time
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--deployment', required=True, type=Path)
parser.add_argument('--origin', required=True)
parser.add_argument('--ca', type=Path, help='Local test CA; public deployments use system trust')
parser.add_argument('--restart', action='store_true', help='Restart only the explicitly selected deployment')
args = parser.parse_args()
assert args.origin.startswith('https://'), 'HTTPS is required'
deployment = args.deployment.resolve()
root = Path(__file__).resolve().parents[1]

def sql(query):
    return subprocess.run(['docker','compose','exec','-T','database','bash','-c',
        'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot --batch --skip-column-names ragnarok'],
        cwd=deployment, input=query, text=True, capture_output=True, check=True).stdout.strip()

trust = ssl.create_default_context(cafile=str(args.ca) if args.ca else None)
def readiness():
    with urllib.request.urlopen(args.origin+'/api/readiness', context=trust, timeout=5) as response:
        data = json.load(response)
    assert data['nativeReady'] and data['assetsReady'] and data['packetver'] == 20211103

username = 'tls_' + secrets.token_hex(5)
password = secrets.token_hex(10)
account = None
character = None
try:
    readiness()
    account = int(sql(f"INSERT INTO login(userid,user_pass,sex,email) VALUES ('{username}','{password}','M','smoke@example.invalid'); SELECT LAST_INSERT_ID();"))
    character = int(sql(f"INSERT INTO `char`(account_id,char_num,name,last_map,last_x,last_y,save_map,save_x,save_y,sex) VALUES ({account},0,'TLS Test {account}','prontera',153,149,'prontera',153,149,'M'); SELECT LAST_INSERT_ID();"))
    sql(f'INSERT INTO inventory(char_id,nameid,amount,identify) VALUES ({character},512,3,1);')
    script = r'''
import fs from 'node:fs';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
let input = ''; for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
const options = {origin:config.origin, ...(config.ca ? {ca:fs.readFileSync(config.ca)} : {})};
const packet = Buffer.alloc(55);
packet.writeUInt16LE(0x64,0); packet.writeUInt32LE(20211103,2);
packet.write(config.username,6,24); packet.write(config.password,30,24);
await new Promise((resolve,reject) => {
  const ws = new WebSocket(config.origin.replace(/^https/,'wss')+'/127.0.0.1:6900', options);
  const timer = setTimeout(() => {ws.terminate();reject(new Error('WSS login timed out'));},15000);
  let data = Buffer.alloc(0);
  ws.on('open', () => ws.send(packet,{binary:true}));
  ws.on('error', reject);
  ws.on('message', chunk => {
    data = Buffer.concat([data,chunk]); if(data.length<4)return;
    try {
      assert.equal(data.readUInt16LE(0),0xac4,'Native login rejected');
      if(data.length<data.readUInt16LE(2))return;
      assert.equal(data.readUInt32LE(8),config.account);
      assert(data.includes(Buffer.from('Quest')),'Character server missing');
      clearTimeout(timer);ws.close();resolve();
    } catch(error) {clearTimeout(timer);ws.terminate();reject(error);}
  });
});
for (const [target,origin] of [['127.0.0.1:6900','https://untrusted.example'],['127.0.0.1:3306',config.origin]]) {
  await new Promise((resolve,reject) => {
    const ws = new WebSocket(config.origin.replace(/^https/,'wss')+'/'+target,{...options,origin});
    const timer = setTimeout(()=>{ws.terminate();reject(new Error('Rejection timed out'));},10000);
    ws.on('unexpected-response',(_,response)=>{clearTimeout(timer);assert.equal(response.statusCode,403);response.resume();ws.terminate();resolve();});
    ws.on('open',()=>{clearTimeout(timer);ws.terminate();reject(new Error('Unauthorized proxy accepted'));});
    ws.on('error',()=>{});
  });
}
console.log('PASS: trusted HTTPS/WSS native SQL login; foreign origins and non-game targets rejected.');
'''
    payload = {'origin':args.origin,'ca':str(args.ca.resolve()) if args.ca else None,
               'username':username,'password':password,'account':account}
    result = subprocess.run(['node','--input-type=module','-e',script],
        input=json.dumps(payload),text=True,cwd=root/'client/ragnarok',capture_output=True,timeout=45)
    if result.returncode:
        raise RuntimeError('TLS/WebSocket verification failed: '+result.stderr.replace(password,'[REDACTED]'))
    print(result.stdout.strip(),flush=True)
    if args.restart:
        subprocess.run(['docker','compose','restart','database','game'],cwd=deployment,check=True)
        deadline = time.monotonic()+60
        while True:
            try:
                readiness();break
            except Exception:
                if time.monotonic()>deadline:raise
                time.sleep(1)
        assert sql(f'SELECT userid FROM login WHERE account_id={account};') == username
        assert sql(f'SELECT last_map,last_x,last_y FROM `char` WHERE char_id={character};') == 'prontera\t153\t149'
        assert sql(f'SELECT amount FROM inventory WHERE char_id={character} AND nameid=512;') == '3'
        print('PASS: account, character position and inventory persisted after database/game restart.',flush=True)
finally:
    if account:
        for field,value in [('char_id',character),('account_id',account)]:
            if value is None:continue
            tables = sql(f"SELECT table_name FROM information_schema.columns WHERE table_schema='ragnarok' AND column_name='{field}';").splitlines()
            for table in tables:
                if table.isidentifier():sql(f'DELETE FROM `{table}` WHERE `{field}`={value};')
