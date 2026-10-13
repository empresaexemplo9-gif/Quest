"""Join the three downloaded Quest GM parts on Windows, macOS or Linux."""
import hashlib,json,shutil,sys,urllib.request
from pathlib import Path
folder=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
base='https://github.com/empresaexemplo9-gif/Quest/releases/download/quest-arquivos-2.0.4/'
with urllib.request.urlopen(base+'Quest-GM-Pacote.json',timeout=60) as response:manifest=json.load(response)
assert manifest['filename']=='DESENVOLVEDOR.zip' and len(manifest['parts'])==3
def digest(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
for index,part in enumerate(manifest['parts'],1):
    assert part['name']==f'Quest-Desenvolvedor-2.0.4.zip.parte{index:02d}'
    file=folder/part['name']
    if not file.exists():raise SystemExit('Baixe as tres partes na mesma pasta: '+part['name'])
    if file.stat().st_size!=part['bytes'] or digest(file)!=part['sha256']:raise SystemExit('Parte incompleta ou incorreta: '+part['name'])
output=folder/'DESENVOLVEDOR.zip'
if output.exists():
    if digest(output)!=manifest['sha256']:raise SystemExit('ZIP existente diferente preservado.')
else:
    with output.open('xb') as target:
        for part in manifest['parts']:
            with (folder/part['name']).open('rb') as source:shutil.copyfileobj(source,target,1024*1024)
    if output.stat().st_size!=manifest['bytes'] or digest(output)!=manifest['sha256']:raise SystemExit('ZIP incorreto.')
print('Pronto: '+str(output))
