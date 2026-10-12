#!/usr/bin/env python3
"""Bundle the tested native runtime for Windows Docker Desktop; no credentials or GRFs."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
deployment = root/'.local/ragnarok/deployment'
context = deployment/'context'
output = root/'public/downloads/Quest-Servidor-Windows.zip'
output.parent.mkdir(parents=True,exist_ok=True)
revision = subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    def add(path,target):archive.write(path,'Quest-Servidor/'+target)
    for path in sorted(context.rglob('*')):
        if not path.is_file():continue
        relative = path.relative_to(context)
        if relative == Path('deploy/ragnarok/Dockerfile'):continue
        if relative.parts[:3] == ('.local','ragnarok','client'):continue
        if relative.parts[:3] == ('engine','rathena','conf') and 'import' in relative.parts:continue
        if any(part in ['.git','__pycache__'] or part.startswith('.env') for part in relative.parts):continue
        add(path,'context/'+relative.as_posix())
    # Always use the reviewed source files, even when the prepared context predates a source update.
    for name,target in [('configure_local.py','configure_server.py'),('IniciarServidor.ps1','IniciarServidor.ps1'),('IniciarServidor.cmd','IniciarServidor.cmd'),('database-init.sh','database-init.sh'),('Caddyfile','Caddyfile')]:
        add(root/'deploy/ragnarok'/name,target)
    add(root/'scripts/download_kro.py','context/scripts/download_kro.py')
    add(root/'deploy/ragnarok/Dockerfile','context/deploy/ragnarok/Dockerfile')
    add(root/'docs/ragnarok-local-windows.md','LEIA-ME.md')
    compose=(root/'deploy/ragnarok/compose.yaml').read_text().replace('name: quest-ragnarok\n','name: quest-ragnarok-pc\n')
    archive.writestr('Quest-Servidor/compose.yaml',compose)
    archive.writestr('Quest-Servidor/ORIGEM.json',json.dumps({'repository':'https://github.com/empresaexemplo9-gif/Quest','revision':revision,'engine':'rAthena Renewal','packetver':20211103,'architecture':'linux/amd64','source_code':'https://github.com/empresaexemplo9-gif/Quest/tree/'+revision+'/engine/rathena','client_assets':'Downloaded and verified on the server computer; credentials generated locally'},indent=2))
with output.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
(output.parent/'Quest-Servidor-Windows.sha256').write_text(digest+'  '+output.name+'\n')
print(json.dumps({'file':str(output),'bytes':output.stat().st_size,'sha256':digest}))
