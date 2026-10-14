import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const yaml=require(path.resolve(process.argv[2]||'.local/ragnarok/browser-build/node_modules/js-yaml'));
const families=[['Novice','SuperNovice','Super_Novice','Hyper_Novice'],['Swordman','Knight','Crusader','Rune_Knight','Dragon_Knight'],['Mage','Wizard','Sage','Warlock','Arch_Mage'],['Archer','Hunter','Bard','Dancer','Ranger','Windhawk'],['Acolyte','Priest','Monk','Arch_Bishop','Cardinal'],['Merchant','Blacksmith','Alchemist','Mechanic','Meister'],['Thief','Assassin','Rogue','Guillotine_Cross','Shadow_Cross']];
const items=yaml.load(fs.readFileSync('engine/rathena/db/re/item_db_equip.yml','utf8')).Body;
const weapons=[['Dagger','1hSword','Mace','Staff'],['1hSword','2hSword','1hSpear','2hSpear','Dagger'],['Staff','2hStaff','Book','Dagger'],['Bow','Dagger'],['Mace','Knuckle','Staff','2hStaff'],['1hAxe','2hAxe','Mace','Dagger'],['Katar','Dagger','1hSword','Bow']];
const lists=families.map((jobs,f)=>items.filter(i=>['Weapon','Armor','ShadowGear'].includes(i.Type)&&(!i.Jobs||i.Jobs.All||jobs.some(j=>i.Jobs[j]))&&(i.Type!=='Weapon'||weapons[f].includes(i.SubType))&&!Object.keys(i.Locations||{}).some(k=>k.startsWith('Costume_'))&&(!i.Gender||i.Gender==='Both')).map(i=>({id:i.Id,name:i.Name,level:i.EquipLevelMin||1,max:i.EquipLevelMax||275,category:i.Type==='Weapon'?'W:'+i.SubType:'A:'+Object.keys(i.Locations||{}).filter(k=>i.Locations[k]).sort().join(','),score:(i.WeaponLevel||i.ArmorLevel||0)*10000+(i.Attack||0)+(i.MagicAttack||0)+(i.Defense||0)*10+(i.Slots||0)*30,grade:!!i.Gradable,refine:i.Refineable?20:0,weapon:i.Type==='Weapon'})));
// Top three per category and level bracket. The full strongest arsenal is
// granted; the equipped set is selected only from gear eligible at BaseLevel.
const catalog=lists.map(rows=>{
 const selected=new Map();
 // Equipment eligibility changes only at minimum levels and maximum+1.
 // Retain the best set at every such boundary, including a GM at level 1.
 const levels=[...new Set([1,275,...rows.flatMap(r=>[r.level,r.max+1])])].filter(n=>n>=1&&n<=275).sort((a,b)=>a-b);
 for(const level of levels){
  const groups=new Map();
  for(const row of rows.filter(r=>r.level<=level&&r.max>=level)){if(!groups.has(row.category))groups.set(row.category,[]);groups.get(row.category).push(row);}
  for(const group of groups.values())for(const row of group.sort((a,b)=>b.score-a.score||b.level-a.level||a.id-b.id).slice(0,3))selected.set(row.id,row);
 }
 const result=[...selected.values()].sort((a,b)=>b.score-a.score||b.level-a.level||a.id-b.id);
 const groups=new Map();
 for(const row of result.filter(r=>r.max>=275)){if(!groups.has(row.category))groups.set(row.category,0);const n=groups.get(row.category);row.grant=n<3;groups.set(row.category,n+1);}
 if(result.filter(r=>r.grant).length>80)throw Error('Strongest arsenal exceeds reserved inventory capacity');
 return result;
});
fs.mkdirSync('content/gm',{recursive:true});
fs.writeFileSync('content/gm/arsenal.json',JSON.stringify({version:1,maximumLevel:275,ranking:'weapon/armor level, ATK/MATK, DEF and card slots; script-dependent builds can differ',families:catalog},null,2)+'\n');
let script='// Generated from the pinned native equipment database. No account credentials.\n-\tscript\tQuestGMArsenal\t-1,{\nOnInit:\n';
for(let f=0;f<7;f++)for(const [field,key] of [['Id','id'],['Min','level'],['Max','max'],['Score','score'],['Refine','refine'],['Weapon','weapon'],['Grant','grant'],['Grade','grade']])script+=` setarray $@QuestGM${field}${f}[0],${catalog[f].map(r=>Number(r[key]||0)).join(',')};\n`;
script+=' end;\n}\n';
fs.writeFileSync('rathena/quest-gm-arsenal.txt',script);
const clientItems={};
const weaponIcons={'Dagger':1201,'1hSword':1101,'2hSword':1151,'1hSpear':1401,'2hSpear':1451,'1hAxe':1301,'2hAxe':1351,'Mace':1501,'Staff':1601,'2hStaff':1601,'Book':1550,'Bow':1701,'Knuckle':1801,'Katar':1250};
const categoryNames={Weapon:'Arma',Armor:'Armadura',ShadowGear:'Equipamento sombrio'};
for(const entry of new Map(catalog.flat().map(r=>[r.id,r])).values()){
 const native=items.find(i=>i.Id===entry.id);
 clientItems[entry.id]={name:entry.name,slots:native.Slots||0,icon:weaponIcons[native.SubType]||2301,description:[categoryNames[native.Type]+' · '+entry.name,'Nível mínimo: '+entry.level+'.',...(native.Attack?['Ataque: '+native.Attack+'.']:[]),...(native.MagicAttack?['Ataque mágico: '+native.MagicAttack+'.']:[]),...(native.Defense?['Defesa: '+native.Defense+'.']:[]),'Os efeitos e requisitos são calculados pelo servidor.','Use @gmquest para repor o arsenal da classe.']};
}
fs.writeFileSync('content/gm/iteminfo.json',JSON.stringify(clientItems,null,2)+'\n');
console.log(JSON.stringify({families:catalog.map(r=>({catalog:r.length,strongest:r.filter(i=>i.grant).length})),generated:true}));
