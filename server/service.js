import {randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {createPlayer,performAction,snapshot,GameError,safeName} from '../public/game/core.js';
import {CLASSES} from '../public/game/content.js';

const scrypt=promisify(scryptCallback);
const tokenHash=token=>createHash('sha256').update(token).digest('hex');
const normalize=value=>safeName(value,24).toLocaleLowerCase('pt-BR');
export class ServiceError extends Error{constructor(message,status=400){super(message);this.status=status;}}

export function createService(store){
 async function authenticate(cookie){const token=/^([a-f0-9]{64})$/.test(cookie||'')?cookie:null;if(!token)throw new ServiceError('Entre com sua conta para acessar o mundo compartilhado.',401);const id=await store.getSession(tokenHash(token));if(!id)throw new ServiceError('Sua sessão expirou. Entre novamente.',401);return id;}
 async function session(account){const token=randomBytes(32).toString('hex');await store.createSession(tokenHash(token),account.id,Date.now()+7*86400000);const data=await store.updateWorld(world=>{if(!world.players[account.id])createPlayer(world,account.id,account.name,account.classId);performAction(world,account.id,{type:'heartbeat'});return snapshot(world,account.id);});return {token,data};}
 return {
  async limit(key,operation){const auth=['register','login','changePassword'].includes(operation);if(!await store.consumeQuota(tokenHash(key)+':'+(auth?'auth':'game'),auth?20:1500,60000))throw new ServiceError('Muitas solicitações. Aguarde um minuto e tente novamente.',429);},
  async health(){try{await store.ping();return {online:true,version:'1.3.0',database:store.kind};}catch{return {online:false,version:'1.3.0',database:store.kind};}},
  async profile(cookie){const id=await authenticate(cookie);const account=await store.getAccountById(id);if(!account)throw new ServiceError('Conta não encontrada.',404);return {username:account.username,name:account.name,classId:account.classId};},
  async changePassword(cookie,{currentPassword,newPassword}){const id=await authenticate(cookie);const account=await store.getAccountById(id);if(typeof currentPassword!=='string'||currentPassword.length>128||typeof newPassword!=='string'||newPassword.length<8||newPassword.length>128)throw new ServiceError('Informe a senha atual e uma nova senha de 8 a 128 caracteres.');const current=await scrypt(currentPassword,account.salt,64);if(!timingSafeEqual(current,Buffer.from(account.passwordHash,'hex')))throw new ServiceError('Senha atual incorreta.',401);account.salt=randomBytes(16).toString('hex');account.passwordHash=(await scrypt(newPassword,account.salt,64)).toString('hex');await store.updateAccount(account);await store.deleteAccountSessions(account.id);return session(account);},
  async register({username,password,name,classId}){
   username=normalize(username);if(typeof password!=='string'||password.length<8||password.length>128)throw new ServiceError('A senha deve ter entre 8 e 128 caracteres.');if(!Object.hasOwn(CLASSES,classId))throw new ServiceError('Escolha uma classe válida.');name=safeName(name||username);
   const salt=randomBytes(16).toString('hex'),derived=await scrypt(password,salt,64);const account={username,name,classId,id:randomUUID(),salt,passwordHash:derived.toString('hex')};if(!await store.createAccount(account))throw new ServiceError('Esse nome de conta já está em uso.',409);return session(account);
  },
  async login({username,password}){username=normalize(username);if(typeof password!=='string'||password.length>128)throw new ServiceError('Conta ou senha incorretas.',401);const account=await store.getAccount(username);const salt=account?.salt||'00000000000000000000000000000000';const derived=await scrypt(password,salt,64);if(!account||!timingSafeEqual(derived,Buffer.from(account.passwordHash,'hex')))throw new ServiceError('Conta ou senha incorretas.',401);return session(account);},
  async logout(cookie){if(cookie)await store.deleteSession(tokenHash(cookie));return {ok:true};},
  async state(cookie){const id=await authenticate(cookie);return store.updateWorld(world=>{performAction(world,id,{type:'heartbeat'});return snapshot(world,id);});},
  async action(cookie,action){const id=await authenticate(cookie);if(!action||typeof action.type!=='string'||(typeof action.id!=='string'||!/^[a-zA-Z0-9_-]{4,80}$/.test(action.id)))throw new ServiceError('Ação inválida.');return store.updateWorld(world=>{performAction(world,id,action);return snapshot(world,id);},{actorId:id,actionId:action.id,type:action.type,onDuplicate:world=>snapshot(world,id)});}
 };
}

export async function handleGameRequest(req,res,service,diagnostics={}){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const url=new URL(req.url,'http://'+(req.headers.host||'localhost'));const cookie=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('eridan_session='))?.slice('eridan_session='.length);
 const secure=req.headers['x-forwarded-proto']==='https'||!!req.socket?.encrypted;
 const setSession=value=>res.setHeader('Set-Cookie',`eridan_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${value?'604800':'0'}${secure?'; Secure':''}`);
 try{
  const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host)throw new ServiceError('Origem da solicitação não permitida.',403);
  if(url.pathname==='/api/health'){const health=service?await service.health():{online:false,version:'1.3.0',database:null,...diagnostics};res.statusCode=health.online?200:503;res.end(JSON.stringify(health));return;}
  if(!service)throw new ServiceError('O mundo compartilhado está temporariamente indisponível. Sua jornada solo continua disponível.',503);
  let input={};if(req.method==='POST'){
   if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new ServiceError('Use conteúdo JSON para essa operação.',415);
   if(req.body&&typeof req.body==='object'){if(Buffer.byteLength(JSON.stringify(req.body))>16384)throw new ServiceError('Solicitação grande demais.',413);input=req.body;}
   else{let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>16384)throw new ServiceError('Solicitação grande demais.',413);}try{input=JSON.parse(data||'{}');}catch{throw new ServiceError('Solicitação inválida.');}}
  }
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ServiceError('Solicitação JSON inválida.');
  let output;
  const operation=url.searchParams.get('action')||input.operation||'state';
  const ip=process.env.VERCEL||process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]:req.socket?.remoteAddress||'unknown';await service.limit(ip,operation);
  if(['register','login','logout','action','changePassword'].includes(operation)&&req.method!=='POST')throw new ServiceError('Use POST para essa operação.',405);
  if(operation==='register'||operation==='login'||operation==='changePassword'){const result=await (operation==='changePassword'?service.changePassword(cookie,input):service[operation](input));setSession(result.token);output=result.data;}
  else if(operation==='logout'){output=await service.logout(cookie);setSession('');}
  else if(operation==='action')output=await service.action(cookie,input.action);
  else if(operation==='profile')output=await service.profile(cookie);
  else if(operation==='state')output=await service.state(cookie);
  else throw new ServiceError('Operação desconhecida.',404);
  res.statusCode=200;res.end(JSON.stringify(output));
 }catch(error){res.statusCode=error instanceof ServiceError?error.status:error instanceof GameError?400:500;res.end(JSON.stringify({error:res.statusCode===500?'Não foi possível sincronizar o mundo. Tente novamente.':error.message}));}
}
