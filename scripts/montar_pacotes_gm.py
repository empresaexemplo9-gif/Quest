"""Build portable archives with one Eridan root, without copying expanded projects."""
import argparse,hashlib,json,subprocess,zipfile,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--destination',default=str(ROOT/'Distribuicao'))
parser.add_argument('--client-directory')
args=parser.parse_args();destination=Path(args.destination).resolve()
if destination==ROOT:raise SystemExit('Use a pasta Distribuicao, sem substituir o projeto.')
destination.mkdir(parents=True,exist_ok=True)
def digest(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
downloads=ROOT/'public/downloads';player=downloads/'Quest-Ragnarok-Setup.exe'
release=json.loads((downloads/'Quest-Ragnarok-SHA256SUMS.json').read_text())[player.name]
assert player.stat().st_size==release['bytes'] and digest(player)==release['sha256']
server=downloads/'Quest-Servidor-Windows.zip'
assert digest(server)==(downloads/'Quest-Servidor-Windows.sha256').read_text().split()[0]
components=json.loads((ROOT/'client/ragnarok/components.lock.json').read_text())
editor=next(c for c in components['components'] if c['name']=='BrowEdit3-Windows')
editor_archive=ROOT/'.local/ragnarok/archives'/editor['archive'];assert digest(editor_archive)==editor['sha256']
client=Path(args.client_directory).resolve() if args.client_directory else ROOT/'Dados'
if not client.is_dir():client=ROOT/'.local/ragnarok/windows-server/Quest-Servidor/context/.local/ragnarok/client'
lock=json.loads((ROOT/'client/ragnarok/kro.lock.json').read_text())
for record in lock['files']:
    file=client/record['name'];assert file.stat().st_size==record['bytes'] and digest(file)==record['sha256'],record['name']
paths=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode('utf-8').split('\0')
source={name:ROOT/name for name in paths if name and name not in ['public/central/catalogo.json','public/central/indice.json']}
for name in source:
    assert not any(p in ['.local','.git','node_modules','Dados','Servidor','Cliente','Privado'] for p in Path(name).parts),name
    assert not Path(name).name.startswith('.env') or Path(name).name=='.env.example',name
source['.local/ragnarok/archives/'+editor['archive']]=editor_archive
for record in lock['files']:source['Dados/'+record['name']]=client/record['name']
player_files={'Quest-Ragnarok.exe':player,'Jogar.cmd':ROOT/'Jogar.cmd'}
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
summary={'version':release['version'],'sourceRevision':revision,'sourceFiles':len(paths)-1,'rootFolder':'Eridan','packages':[]}
for name,files in [('JOGADOR',player_files),('DESENVOLVEDOR',source)]:
    final=destination/(name+'.zip');temporary=destination/(name+'.zip.part');manifest={}
    with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as archive:
        for relative,file in sorted(files.items()):
            if not file.is_file():continue
            assert not file.is_symlink(),relative
            method=zipfile.ZIP_STORED if relative.startswith('Dados/') else zipfile.ZIP_DEFLATED
            archive.write(file,'Eridan/'+relative,compress_type=method)
            manifest[relative]={'bytes':file.stat().st_size,'sha256':digest(file)}
        archive.writestr('Eridan/ARQUIVOS-SHA256.json',json.dumps(manifest,ensure_ascii=False,indent=2))
        if name=='JOGADOR':archive.writestr('Eridan/LEIA-ME.txt','ERIDAN\nAbra Jogar.cmd. O cliente e os dados ficam nesta mesma pasta.\nO servidor principal precisa estar ligado. No iPad: https://quest-game-plum.vercel.app/entrar.html.\n')
    with zipfile.ZipFile(temporary) as archive:
        if archive.testzip() is not None:raise SystemExit('Arquivo ZIP corrompido.')
        assert all(p.filename.startswith('Eridan/') for p in archive.infolist())
        assert not any('Codigo-fonte/' in p.filename or 'DESENVOLVEDOR/' in p.filename for p in archive.infolist())
        for relative,record in manifest.items():
            with archive.open('Eridan/'+relative) as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==record['sha256'],relative
    os.replace(temporary,final)
    summary['packages'].append({'folder':name,'files':len(manifest),'uncompressedBytes':sum(r['bytes'] for r in manifest.values()),'zipBytes':final.stat().st_size,'sha256':digest(final)})
    print(name+': raiz Eridan, arquivos e ZIP verificados.',flush=True)
(destination/'PACOTES.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'destination':str(destination),**summary},ensure_ascii=False),flush=True)
