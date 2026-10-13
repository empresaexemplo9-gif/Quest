import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {prepareCity} from '../../client/ragnarok/prepare-city.mjs';

const root = '/app';
const engine = path.join(root, 'engine/rathena');
prepareCity(root);
const imports = path.join(engine, 'conf/import');
const dbPassword = process.env.MARIADB_PASSWORD;
const interPassword = process.env.QUEST_INTER_PASSWORD;
if (!/^[a-f0-9]{64}$/.test(dbPassword || '') || !/^[a-f0-9]{22}$/.test(interPassword || '')) throw new Error('Missing generated native service credential');
const settings = {};
let database = '';
for (const prefix of ['login_server','ipban_db','char_server','map_server','web_server','log_db']) {
  for (const [name,value] of Object.entries({ip:'database',port:3306,id:'quest',pw:dbPassword,db:prefix==='log_db'?'ragnarok_log':'ragnarok'})) database += `${prefix}_${name}: ${value}\n`;
}
settings.inter = database;
settings.login = 'bind_ip: 127.0.0.1\nnew_account: yes\nnew_account_name_length: 4\nnew_account_pass_length: 8\nipban_dynamic_pass_failure_ban: no\n';
settings.char = `bind_ip: 127.0.0.1\nlogin_ip: 127.0.0.1\nchar_ip: 127.0.0.1\nserver_name: Quest\nuserid: quest_inter\npasswd: ${interPassword}\nstart_point: er_chama0,48,28\npincode_enabled: no\npincode_force: no\n`;
settings.map = `bind_ip: 127.0.0.1\nchar_ip: 127.0.0.1\nmap_ip: 127.0.0.1\nuserid: quest_inter\npasswd: ${interPassword}\n`;
settings.web = 'bind_ip: 127.0.0.1\n';
settings.log = '// Database configuration is in inter_conf.txt.\n';
settings.battle = 'feature.mesitemicon: off\n';
// The native listeners are private. Public attempts are bounded by the HTTPS/WSS gateway;
// health checks and multiple players otherwise trigger the engine's five-connection localhost limit.
settings.packet = 'allow: 127.0.0.1\nddos_count: 100\n';
fs.mkdirSync(imports, {recursive:true});
const messageImport = path.join(engine,'conf/msg_conf/import/map_msg_eng_conf.txt');
fs.mkdirSync(path.dirname(messageImport),{recursive:true});
if(!fs.existsSync(messageImport))fs.writeFileSync(messageImport,'// Quest optional message overrides.\n');
for (const filename of fs.readdirSync(path.join(engine, 'conf/import-tmpl'))) {
  const destination = path.join(imports, filename);
  if (!fs.existsSync(destination)) fs.copyFileSync(path.join(engine, 'conf/import-tmpl', filename), destination);
}
for (const [name,content] of Object.entries(settings)) fs.writeFileSync(path.join(imports, `${name}_conf.txt`), content, {mode:0o600});
const resources = path.join(root, '.local/ragnarok/vendor/RemoteClient/resources');
fs.mkdirSync(resources, {recursive:true});
fs.writeFileSync(path.join(resources,'DATA.INI'), '[Data]\n0=/app/.local/ragnarok/client/rdata.grf\n1=/app/.local/ragnarok/client/data.grf\n');
const children = [];
const readiness = {char:false, map:false};
const readinessFile = '/tmp/quest-native-ready.json';
process.env.QUEST_RO_REQUIRE_HANDSHAKE = readinessFile;
process.env.QUEST_RO_TRUST_PROXY = '1';
fs.writeFileSync(readinessFile, JSON.stringify(readiness), {mode:0o600});
let stopping = false;
function stop(exitCode) {
  if (stopping) return; stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 3000);
}
function launch(command, args, cwd) {
  const child = spawn(command, args, {cwd,stdio:['ignore','pipe','pipe'],env:process.env});
  let recentOutput = '';
  child.stdout.on('data', data => {
    process.stdout.write(data);
    recentOutput = (recentOutput + data.toString()).slice(-4096);
    const type = command.endsWith('/char-server') ? 'char' : command.endsWith('/map-server') ? 'map' : null;
    if (type) {
      const connected = recentOutput.lastIndexOf(type === 'char' ? 'Connected to login-server' : 'Map-server connected to char-server');
      const disconnected = recentOutput.lastIndexOf(type === 'char' ? 'Connection to Login Server lost' : 'Connection to Char Server lost');
      if (Math.max(connected,disconnected) >= 0 && readiness[type] !== (connected > disconnected)) {
        readiness[type] = connected > disconnected;
        fs.writeFileSync(readinessFile, JSON.stringify(readiness), {mode:0o600});
      }
    }
  });
  child.stderr.on('data', data => process.stderr.write(data));
  children.push(child);
  child.on('error', () => stop(1));
  child.on('exit', () => {if(!stopping)stop(1);});
}
launch(path.join(engine,'login-server'), [], engine);
launch(path.join(engine,'char-server'), [], engine);
launch(path.join(engine,'map-server'), [], engine);
launch(path.join(engine,'web-server'), [], engine);
launch(process.execPath, ['client/ragnarok/assets.mjs'], root);
launch(process.execPath, ['client/ragnarok/serve.mjs'], root);
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => stop(0));
