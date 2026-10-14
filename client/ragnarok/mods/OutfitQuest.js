import Client from 'Core/Client.js';
import {decodeOutfit} from './OutfitLogic.js';
const layered=['head','weapon','weapon_trail','shield','accessory','accessory2','accessory3','robe'];
// Saved native clothing codes synchronize costumes and dyes to every viewer.
// Inventory, combat stats, hitboxes and the selected job stay authoritative.
export function applyQuestOutfit(entity){
 const costume=entity.objecttype===0?decodeOutfit(entity._bodypalette):null;
 if(!costume){
  if(entity._questOutfit){entity._questOutfit=null;entity.job=entity._job;entity.head=entity._head;entity.weapon=entity._weapon;entity.shield=entity._shield;entity.accessory=entity._accessory;entity.accessory2=entity._accessory2;entity.accessory3=entity._accessory3;entity.robe=entity._robe;}
  return;
 }
 const path='data/sprite/quest/'+costume.name+'-'+costume.style;
 entity._questOutfit=path;
 entity.files.body.spr=path+'.spr';entity.files.body.act=path+'.act';entity.files.body.size=1;
 entity.files.body.pal=costume.color?path+'-'+costume.color+'.pal':null;
 // Each atlas contains the whole dressed character and the class weapon.
 for(const part of layered)if(entity.files[part]){entity.files[part].spr=null;entity.files[part].act=null;}
 entity.gr2=null;
 Client.loadFile(entity.files.body.spr);Client.loadFile(entity.files.body.act);
}
