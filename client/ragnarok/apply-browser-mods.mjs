import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=path.resolve(process.argv[2]||path.join(root,'.local/ragnarok/vendor/roBrowserLegacy'));
const target=path.join(root,'.local/ragnarok/browser-build');
if(!fs.existsSync(path.join(source,'src/UI/Background.js')))throw Error('Prepare the pinned roBrowser source before applying Quest modifications.');
fs.mkdirSync(target,{recursive:true});
fs.cpSync(source,target,{recursive:true,filter:p=>!p.split(path.sep).some(part=>['node_modules','.git','dist'].includes(part))});
fs.copyFileSync(path.join(root,'client/ragnarok/mods/CharCreateQuest.js'),path.join(target,'src/UI/Components/CharCreate/CharCreatev4/CharCreatev4.js'));
fs.copyFileSync(path.join(root,'client/ragnarok/mods/LocalePt.js'),path.join(target,'src/UI/LocalePt.js'));
fs.copyFileSync(path.join(root,'client/ragnarok/mods/GraphicsQuest.js'),path.join(target,'src/Renderer/GraphicsQuest.js'));
fs.copyFileSync(path.join(root,'client/ragnarok/mods/SpritePaletteQuest.fs'),path.join(target,'src/Renderer/SpriteRenderer.fs'));
for(const [name,destination] of [['TouchQuest.js','MobileUI.js'],['TouchLogic.js','TouchLogic.js'],['TouchQuest.css','TouchQuest.css']])fs.copyFileSync(path.join(root,'client/ragnarok/mods',name),path.join(target,'src/UI/Components/MobileUI',destination));
for(const name of ['OutfitQuest.js','OutfitLogic.js'])fs.copyFileSync(path.join(root,'client/ragnarok/mods',name),path.join(target,'src/Renderer/Entity',name));
fs.writeFileSync(path.join(target,'src/DB/QuestItems.js'),'export default '+fs.readFileSync(path.join(root,'content/gm/iteminfo.json'),'utf8')+';\n');
function replace(file,original,replacement){const filename=path.join(target,'src',file);const content=fs.readFileSync(filename,'utf8').replaceAll('\r\n','\n');if(!content.includes(original))throw Error('Pinned source changed: '+file);fs.writeFileSync(filename,content.replace(original,replacement));}
replace('Renderer/Entity/EntityRender.js',"import Client from 'Core/Client.js';","import Client from 'Core/Client.js';\nimport {applyQuestOutfit} from './OutfitQuest.js';");
replace('Renderer/Entity/EntityRender.js','return function _renderEntity() {','return function _renderEntity() {\n\t\tapplyQuestOutfit(this);');
const entityRender=path.join(target,'src/Renderer/Entity/EntityRender.js');
fs.writeFileSync(entityRender,fs.readFileSync(entityRender,'utf8').replaceAll('self.hasCart == true','self.hasCart == true && !self._questOutfit'));
replace('Network/PacketStructure.js','this.code = fp.readChar();\n\tfp.seek(20, SEEK_CUR);','this.code = fp.readChar();\n\tthis.questGM = fp.readUChar() === 98;\n\tfp.seek(19, SEEK_CUR);');
replace('Engine/CharEngine.js','function onConnectionAccepted(pkt) {','function onConnectionAccepted(pkt) {\n\tif (typeof pkt.questGM === "boolean") Session.QuestGM = pkt.questGM;');
replace('DB/DBManager.js',"import Client from 'Core/Client.js';","import Client from 'Core/Client.js';\nimport QuestItems from './QuestItems.js';");
replace('DB/DBManager.js','const item = ItemTable[itemid] || unknownItem;',`const override = QuestItems[itemid];
        const original = ItemTable[itemid];
        const item = original?.identifiedDisplayName ? original : override ? (ItemTable[itemid] = {
            ...(ItemTable[override.icon] || unknownItem),
            identifiedDisplayName:override.name, unidentifiedDisplayName:override.name,
            identifiedDescriptionName:override.description, unidentifiedDescriptionName:override.description,
            slotCount:override.slots, _decoded:false
        }) : unknownItem;`);
replace('UI/GUIComponent.js',"import CommonCSS from './Common.css?raw';","import CommonCSS from './Common.css?raw';\nimport {localize} from './LocalePt.js';");
replace('UI/GUIComponent.js','this._container.innerHTML = this.render();','this._container.innerHTML = this.render();\n\t\t\tlocalize(this._container);');
replace('UI/Elements/UIButton.js',"import DB from 'DB/DBManager.js';","import DB from 'DB/DBManager.js';\nimport {buttonLabel} from 'UI/LocalePt.js';");
replace('UI/Elements/UIButton.js',"const bg = this.getAttribute('bg');",`const bg = this.getAttribute('bg');
        const questLabel = buttonLabel(bg || '');
        if (questLabel) {
            this.textContent = questLabel;
            this.setAttribute('aria-label',questLabel);
            this.setAttribute('role','button');
            this.tabIndex = 0;
            this.style.setProperty('background-image','none','important');
            Object.assign(this.style,{backgroundColor:'#eef1ea',color:'#172b35',font:'12px Arial',border:'1px solid #6b7680',borderRadius:'3px',textAlign:'center',minWidth:'42px',lineHeight:'19px',boxSizing:'border-box'});
            this.addEventListener('keydown',event=>{if(!this.disabled && ['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();this.click();}});
        }`);
replace('UI/Components/ChatBox/ChatBox.js',"activeElement.tagName === 'BUTTON' && !root.contains(activeElement)","['BUTTON','UI-BUTTON'].includes(activeElement.tagName) && !root.contains(activeElement)");
replace('UI/Background.js','static getLoginBackgroundName() {','static getLoginBackgroundName() {\n\t\treturn "quest/login-pt.png";');
replace('UI/Background.js','static setLoading(callback) {','static setLoading(callback) {\n\t\tBackground._loading = ["quest/loading-pt.png"];');
replace('DB/DBManager.js',"() => loadCSV('data/msgstringtable.csv', MsgStringTable, 0, 1, loadmsg)",'loadmsg');
for(const custom of [true,false]){
 const original=`tryLoadLuaAliases(loadItemInfo, iteminfoNames, null, onLoad()${custom?', true':''});`;
 replace('DB/DBManager.js',original,`const questItemsDone = onLoad();\n\t\t\t\ttryLoadLuaAliases(loadItemInfo, iteminfoNames, null, () => questLocalizeItems(questItemsDone)${custom?', true':''});`);
}
replace('DB/DBManager.js','function loadTable(filename, separator, size, callback, onEnd, useCharPage = false) {',`function questLocalizeItems(onEnd) {
 let pending=4;
 const done=()=>{if(--pending===0)onEnd();};
 for(const [filename,field,names] of [
 ['num2itemdisplaynametable.txt','unidentifiedDisplayName',true],
 ['idnum2itemdisplaynametable.txt','identifiedDisplayName',true],
 ['num2itemdesctable.txt','unidentifiedDescriptionName',false],
 ['idnum2itemdesctable.txt','identifiedDescriptionName',false]]) {
  loadTable('data/'+filename,'#',2,(_index,key,value)=>{
   if(ItemTable[key])ItemTable[key][field]=names?value.replace(/_/g,' '):value.split('\\n');
  },done,true);
 }
}
function loadTable(filename, separator, size, callback, onEnd, useCharPage = false) {`);
replace('DB/DBManager.js','data = TextEncoding.decode(data, useCharPage ? userCharpage : null);',`const questPortuguese = new Set(${JSON.stringify(['msgstringtable.txt','idnum2itemdisplaynametable.txt','idnum2itemdesctable.txt','num2itemdisplaynametable.txt','num2itemdesctable.txt','mapnametable.txt','questid2display.txt','tipoftheday.txt','bookitemnametable.txt'].map(n=>'data/'+n))});
\t\t\tdata = TextEncoding.decode(data, questPortuguese.has(filename) ? 'utf-8' : (useCharPage ? userCharpage : null));`);
replace('Renderer/Renderer.js', "import MemoryManager from 'Core/MemoryManager.js';", "import MemoryManager from 'Core/MemoryManager.js';\nimport QuestGraphics from './GraphicsQuest.js';");
replace('Renderer/Renderer.js',`const quality = Configs.get('quality', 100) / 100;\n\t\twidth *= quality;\n\t\theight *= quality;`,
`const size = QuestGraphics.size(this.gl, width, height, dpr);\n\t\twidth = size.width / dpr;\n\t\theight = size.height / dpr;`);
replace('Renderer/Renderer.js', "Background.resize(this.width, this.height);", "Background.resize(this.width, this.height);\n\t\tQuestGraphics.resized();");
replace('Renderer/Renderer.js', "document.body.appendChild(this.canvas);", "document.body.appendChild(this.canvas);\n\t\t\tQuestGraphics.attach(this);");
replace('Renderer/Renderer.js', "document.body.removeChild(this.canvas);", "document.body.removeChild(this.canvas);\n\t\t\tQuestGraphics.detach();");
replace('Renderer/Renderer.js', "this.contextLost = true;", "this.contextLost = true;\n\t\tQuestGraphics.recover();");
replace('Renderer/Renderer.js', "// Execute render callbacks", "QuestGraphics.frame(this, performance.now());\n\t\t// Execute render callbacks");
replace('Utils/WebGL.js', "import Configs from 'Core/Configs.js';", "import Configs from 'Core/Configs.js';\nimport {filterTexture} from 'Renderer/GraphicsQuest.js';");
replace('Utils/WebGL.js', "const enableMipmap = Configs.get('enableMipmap');", "const enableMipmap = true;");
replace('Utils/WebGL.js', "args.unshift(_texture);", "filterTexture(gl, enableMipmap);\n\t\t\targs.unshift(_texture);");
replace('Renderer/Map/Ground.js', "import Configs from 'Core/Configs.js';", "import Configs from 'Core/Configs.js';\nimport {filterTexture} from 'Renderer/GraphicsQuest.js';");
replace('Renderer/Map/Ground.js', "const enableMipmap = Configs.get('enableMipmap');\n\tif (enableMipmap) {\n\t\tgl.generateMipmap(gl.TEXTURE_2D);\n\t}\n}", "filterTexture(gl, true, true);\n}");
const uiPath='data/texture/À¯ÀúÀÎÅÍÆäÀÌ½º/quest';
for(const name of ['login-pt.png','loading-pt.png']){
 const destination=path.join(root,'content/ragnarok',uiPath,name);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,'public/art/ragnarok',name),destination);
}
fs.writeFileSync(path.join(target,'QUEST-MODS.json'),JSON.stringify({upstream:'a9d31a10880740f4a351fcfca402ea6567022926',source:'https://github.com/MrAntares/roBrowserLegacy',modifications:['seven human starting classes','Portuguese login and loading artwork','8K scene supersampling with GPU limits and performance adaptation','trilinear model filtering and up to 16x anisotropic world textures','Portuguese graphics controls with actual drawing buffer resolution','iPad native movement joystick and six-target combat wheel','GM reference costumes with native animation and synchronized dye palettes']},null,2));
console.log(JSON.stringify({source,target,modified:true}));
