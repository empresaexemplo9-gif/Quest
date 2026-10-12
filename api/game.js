import {createStore} from '../server/store.js';
import {createService,handleGameRequest} from '../server/service.js';
let servicePromise;let initializationError=null;
const storageConfigured=()=>!!(process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL_NON_POOLING);
export default async function handler(req,res){servicePromise??=createStore().then(createService).catch(error=>{initializationError=error.message==='ONLINE_STORAGE_UNAVAILABLE'?'DATABASE_NOT_CONFIGURED':'DATABASE_CONNECTION_FAILED';return null;});await handleGameRequest(req,res,await servicePromise,{storageConfigured:storageConfigured(),initializationError});}
