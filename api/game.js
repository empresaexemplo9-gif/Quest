import {createStore} from '../server/store.js';
import {createService,handleGameRequest} from '../server/service.js';
let servicePromise;
export default async function handler(req,res){servicePromise??=createStore().then(createService).catch(()=>null);await handleGameRequest(req,res,await servicePromise);}
