#!/usr/bin/env python3
"""Bundle the tested native runtime for Windows Docker Desktop; no credentials or GRFs."""
import hashlib
import argparse
import json
import re
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
deployment = root/'.local/ragnarok/deployment'
context = deployment/'context'
if not context.is_dir():
    context = root/'.local/ragnarok/windows-server/Quest-Servidor/context'
if not context.is_dir():
    raise SystemExit('Prepare the tested native runtime before building its Windows package.')
release = json.loads((root/'client/ragnarok/release.lock.json').read_text())
for name, key in [('engine/rathena/char-server','charBinary'),('.local/ragnarok/vendor/roBrowserLegacy/dist/Web/Online.js','browserBundle')]:
    with (context/name).open('rb') as stream:
        if hashlib.file_digest(stream,'sha256').hexdigest() != release[key]:
            raise SystemExit('Prepared runtime differs from the tested release: '+name)
reviewed = ['deploy/ragnarok/Dockerfile', 'client/ragnarok/check-public.mjs',
            'client/ragnarok/serve.mjs', 'client/ragnarok/accounts.mjs', 'client/ragnarok/portal-login.js',
            'client/ragnarok/prepare-city.mjs', 'deploy/ragnarok/supervisor.mjs',
            'scripts/download_kro.py', 'client/ragnarok/apply-browser-mods.mjs',
            'client/ragnarok/mods/CharCreateQuest.js','client/ragnarok/mods/LocalePt.js',
            'client/ragnarok/browser-build.lock.json','client/ragnarok/release.lock.json']
output = root/'public/downloads/Quest-Servidor-Windows.zip'
output.parent.mkdir(parents=True,exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--revision',help='Verified Git revision when building inside the pinned Python container')
args = parser.parse_args()
revision = args.revision or subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
if not re.fullmatch('[a-f0-9]{40}',revision):
    raise SystemExit('A complete verified Git revision is required.')
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    def add(path,target):archive.write(path,'Quest-Servidor/'+target)
    for path in sorted(context.rglob('*')):
        if not path.is_file():continue
        relative = path.relative_to(context)
        if relative in [Path(name) for name in reviewed]:continue
        if relative.parts[:1] in [('content',),('rathena',)] or relative.parts[:3] == ('public','art','ragnarok'):continue
        if relative.parts[:3] == ('.local','ragnarok','client'):continue
        if relative.parts[:3] == ('engine','rathena','conf') and 'import' in relative.parts:continue
        if any(part in ['.git','__pycache__'] or part.startswith('.env') for part in relative.parts):continue
        add(path,'context/'+relative.as_posix())
    # Always use the reviewed source files, even when the prepared context predates a source update.
    for name,target in [('configure_local.py','configure_server.py'),('IniciarServidor.ps1','IniciarServidor.ps1'),('IniciarServidor.cmd','IniciarServidor.cmd'),('database-init.sh','database-init.sh'),('Caddyfile','Caddyfile')]:
        add(root/'deploy/ragnarok'/name,target)
    for name in reviewed:
        add(root/name,'context/'+name)
    for folder in ['content/eridan','content/ragnarok','public/art/ragnarok','rathena']:
        for path in sorted((root/folder).rglob('*')):
            if path.is_file():add(path,'context/'+path.relative_to(root).as_posix())
    add(root/'docs/ragnarok-local-windows.md','LEIA-ME.md')
    add(root/'docs/editar-chama-viva.md','EDITAR-VILA.md')
    add(root/'docs/atualizacao-classes-e-artes.md','CLASSES-E-ARTES.md')
    compose=(root/'deploy/ragnarok/compose.yaml').read_text().replace('name: quest-ragnarok\n','name: quest-ragnarok-pc\n')
    archive.writestr('Quest-Servidor/compose.yaml',compose)
    archive.writestr('Quest-Servidor/ORIGEM.json',json.dumps({'repository':'https://github.com/empresaexemplo9-gif/Quest','revision':revision,'engine':'rAthena Renewal','packetver':20211103,'architecture':'linux/amd64','source_code':'https://github.com/empresaexemplo9-gif/Quest/tree/'+revision+'/engine/rathena','client_assets':'Downloaded and verified on the server computer; credentials generated locally'},indent=2))
with output.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
(output.parent/'Quest-Servidor-Windows.sha256').write_text(digest+'  '+output.name+'\n')
print(json.dumps({'file':str(output),'bytes':output.stat().st_size,'sha256':digest}))
