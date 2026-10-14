"""Prepare a cloud distribution from the verified physical GM/player packages."""
import argparse,hashlib,json,shutil,zipfile,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--packages',type=Path,required=True);args=parser.parse_args()
packages=args.packages.resolve();summary=json.loads((packages/'PACOTES.json').read_text(encoding='utf-8-sig'))
version=summary.get('version','2.0.4')
assert re.fullmatch(r'\d+\.\d+\.\d+',version)
tag='quest-arquivos-'+version;base='https://github.com/empresaexemplo9-gif/Quest/releases/download/'+tag+'/'
destination=ROOT/'.local/shared-release'/tag;destination.mkdir(parents=True,exist_ok=True)
def digest(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
records={r['folder']:r for r in summary['packages']}
for name in ['JOGADOR','DESENVOLVEDOR']:
    file=packages/(name+'.zip');assert file.stat().st_size==records[name]['zipBytes'] and digest(file)==records[name]['sha256']
shutil.copy2(packages/'JOGADOR.zip',destination/f'Quest-Jogador-{version}.zip')
parts=[];part_size=1536*1024**2
with (packages/'DESENVOLVEDOR.zip').open('rb') as source:
    index=1
    while True:
        block=source.read(1024*1024)
        if not block:break
        name=f'Quest-Desenvolvedor-{version}.zip.parte{index:02d}';target=destination/name;size=0
        with target.open('wb') as stream:
            while block:
                stream.write(block);size+=len(block)
                if size==part_size:break
                block=source.read(min(1024*1024,part_size-size))
        parts.append({'name':name,'bytes':size,'sha256':digest(target),'url':base+name});index+=1
manifest={'version':version,'sourceRevision':summary['sourceRevision'],'filename':'DESENVOLVEDOR.zip','bytes':records['DESENVOLVEDOR']['zipBytes'],'sha256':records['DESENVOLVEDOR']['sha256'],'parts':parts}
(destination/'Quest-GM-Pacote.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
# A normal small ZIP provides the complete development source/editor/runtime;
# the full three-part ZIP additionally includes all four verified base client files.
with zipfile.ZipFile(packages/'DESENVOLVEDOR.zip') as source,zipfile.ZipFile(destination/f'Quest-Desenvolvedor-Sem-Dados-Base-{version}.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as target:
    for record in source.infolist():
        if '/Dados-do-cliente/' in record.filename or '/Dados/' in record.filename or record.filename.endswith('/ARQUIVOS-SHA256.json'):continue
        with source.open(record) as read,target.open(record.filename,'w',force_zip64=True) as write:shutil.copyfileobj(read,write,1024*1024)
    target.writestr('Eridan/DADOS-BASE.txt','Este ZIP compacto nao inclui os quatro arquivos base do cliente. Ligar Servidor.cmd baixa e verifica esses arquivos. Para receber tudo junto, use Baixar-Quest-GM.cmd na central.\n')
shutil.copy2(ROOT/'public/central/Baixar-Quest-GM.cmd',destination/'Baixar-Quest-GM-v2.cmd')
shutil.copy2(ROOT/'public/central/Montar-Quest-GM.py',destination/'Montar-Quest-GM.py')
assets=[{'name':p.name,'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(destination.iterdir()) if p.is_file() and p.name!='release-assets.json']
(destination/'release-assets.json').write_text(json.dumps({'tag':tag,'revision':summary['sourceRevision'],'assets':assets},indent=2),encoding='utf-8')
public=ROOT/'public/central';public.mkdir(parents=True,exist_ok=True)
(public/'pacotes.json').write_text(json.dumps({'version':version,'sourceRevision':summary['sourceRevision'],'release':'https://github.com/empresaexemplo9-gif/Quest/releases/tag/'+tag,'assets':[{**a,'url':base+a['name']} for a in assets],'fullDeveloper':manifest},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'directory':str(destination),'parts':len(parts),'assets':len(assets),'bytes':sum(a['bytes'] for a in assets)}),flush=True)
