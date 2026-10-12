import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = path.join(project, '.local/ragnarok');
process.env.DATA_OVERRIDE_PATH ||= path.join(base, 'overlays/english/data');
process.env.BGM_PATH ||= path.join(base, 'client/BGM');
process.env.SYSTEM_PATH ||= path.join(base, 'client/System');
process.env.AI_PATH ||= path.join(base, 'client/AI');
process.env.CACHE_MAX_MEMORY_MB ||= '256';
process.env.CLIENT_AUTOEXTRACT = 'false';
process.env.CLIENT_PUBLIC_URL ||= 'http://127.0.0.1:3005';
process.env.NODE_ENV ||= 'production';

const {default: Client} = await import(path.join(base, 'vendor/RemoteClient/src/controllers/clientController.js'));
const {createApp} = await import(path.join(base, 'vendor/RemoteClient/src/app.js'));
const {default: Validator} = await import(path.join(base, 'vendor/RemoteClient/src/validators/startupValidator.js'));
await Client.init();
const validator = new Validator();
const validation = await validator.validateAll();
if (!validation.success) {
  validator.printReport();
  throw new Error('The native client assets failed validation.');
}
const server = http.createServer(createApp({isProd:true, corsOrigins:[process.env.CLIENT_PUBLIC_URL], validationStatus:validator.getStatusJSON(), requestLogging:false}));
server.listen(3338, '127.0.0.1', () => console.log('Quest native GRF assets validated and served on loopback port 3338.'));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {
  server.close(() => process.exit(0));
});
