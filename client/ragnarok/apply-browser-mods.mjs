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
function replace(file,original,replacement){const filename=path.join(target,'src',file);const content=fs.readFileSync(filename,'utf8').replaceAll('\r\n','\n');if(!content.includes(original))throw Error('Pinned source changed: '+file);fs.writeFileSync(filename,content.replace(original,replacement));}
replace('UI/GUIComponent.js',"import CommonCSS from './Common.css?raw';","import CommonCSS from './Common.css?raw';\nimport {localize} from './LocalePt.js';");
replace('UI/GUIComponent.js','this._container.innerHTML = this.render();','this._container.innerHTML = this.render();\n\t\t\tlocalize(this._container);');
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
fs.writeFileSync(path.join(target,'QUEST-MODS.json'),JSON.stringify({upstream:'a9d31a10880740f4a351fcfca402ea6567022926',source:'https://github.com/MrAntares/roBrowserLegacy',modifications:['seven human starting classes','Portuguese login and loading artwork','8K scene supersampling with GPU limits and performance adaptation','trilinear model filtering and up to 16x anisotropic world textures','Portuguese graphics controls with actual drawing buffer resolution']},null,2));
console.log(JSON.stringify({source,target,modified:true}));
