import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from './store.js';
import {createService,handleGameRequest} from './service.js';

export async function startServer({port=Number(process.env.PORT)||3000,host=process.env.HOST||'127.0.0.1',filename,databaseUrl}={}){
 const store=await createStore({filename,databaseUrl}),service=createService(store),publicRoot=resolve(fileURLToPath(new URL('../public',import.meta.url)));
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.zip':'application/zip','.exe':'application/octet-stream','.png':'image/png'};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){await handleGameRequest(req,res,service);return;}
  try{const pathname=decodeURIComponent(url.pathname),filename=resolve(publicRoot,'.'+(pathname==='/'?'/index.html':pathname));if(!filename.startsWith(publicRoot+sep))throw new Error('path');const info=await stat(filename);if(!info.isFile())throw new Error('file');res.setHeader('Content-Type',mime[extname(filename)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");res.end(await readFile(filename));}catch{res.statusCode=404;res.end('Não encontrado.');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});return {server,store,port:server.address().port,close:()=>new Promise(resolve=>server.close(async()=>{await store.close();resolve();}))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=await startServer();console.log('Cinzas de Éridan: servidor iniciado na porta '+app.port+'.');const stop=async()=>{await app.close();process.exit(0);};process.on('SIGTERM',stop);process.on('SIGINT',stop);}
