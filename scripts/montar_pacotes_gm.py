#!/usr/bin/env python3
"""Copy physical player/developer files into a fresh folder and verify both ZIPs."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--destination', required=True)
parser.add_argument('--client-directory', help='Pasta do cliente preparado; padrao: runtime Windows local')
args = parser.parse_args()
destination = Path(args.destination).resolve()
if destination.exists():
    raise SystemExit('Escolha uma pasta nova; arquivos existentes foram preservados.')
if destination == ROOT or ROOT in destination.parents:
    raise SystemExit('O destino precisa ficar fora do repositorio.')

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

downloads = ROOT / 'public/downloads'
player_name = 'Quest-Ragnarok-Setup.exe'
expected_player = '22905eda3e9e4211909cb17e2e623fe9eaaa5fbf21c6d06835a41494804ac08e'
if digest(downloads / player_name) != expected_player:
    raise SystemExit('O instalador Windows difere da versao verificada.')
server_name = 'Quest-Servidor-Windows.zip'
if digest(downloads / server_name) != (downloads / 'Quest-Servidor-Windows.sha256').read_text().split()[0]:
    raise SystemExit('O pacote do servidor falhou na verificacao.')
components = json.loads((ROOT / 'client/ragnarok/components.lock.json').read_text())
editor = next(row for row in components['components'] if row['name'] == 'BrowEdit3-Windows')
editor_archive = ROOT / '.local/ragnarok/archives' / editor['archive']
if digest(editor_archive) != editor['sha256']:
    raise SystemExit('O pacote do editor falhou na verificacao.')
client_directory = Path(args.client_directory).resolve() if args.client_directory else ROOT / '.local/ragnarok/windows-server/Quest-Servidor/context/.local/ragnarok/client'
client_lock = json.loads((ROOT / 'client/ragnarok/kro.lock.json').read_text())
for record in client_lock['files']:
    original = client_directory / record['name']
    if not original.is_file() or original.stat().st_size != record['bytes'] or digest(original) != record['sha256']:
        raise SystemExit('Dados do cliente ausentes ou divergentes: ' + record['name'])

player = destination / 'JOGADOR'
developer = destination / 'DESENVOLVEDOR'
source = developer / 'Codigo-fonte'
player.mkdir(parents=True)
source.mkdir(parents=True)

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    encoding = 'ascii' if path.suffix.lower() in ('.cmd', '.url') else 'utf-8-sig'
    path.write_text(value, encoding=encoding, newline='\r\n')

shutil.copy2(downloads / player_name, player / player_name)
write(player / 'JOGAR QUEST.url', '[InternetShortcut]\nURL=https://quest-game-plum.vercel.app/entrar.html\n')
write(player / 'LEIA-ME.txt', '''CINZAS DE ERIDAN — JOGADOR

1. Abra Quest-Ragnarok-Setup.exe para instalar o jogo no Windows.
2. Use o atalho criado pelo instalador ou JOGAR QUEST.url.
3. Crie sua conta no portal e escolha uma das sete classes.

Os personagens novos comecam no nivel 10. O PIN interno foi desativado.
O jogo precisa de internet e do servidor principal ligado. Este pacote
nao e um jogo offline. O portal encontra o endereco atual do servidor.
Mapas e recursos adicionais sao carregados do servidor ao jogar.
Feche e reabra o jogo para receber os mapas atualizados.
''')

tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode('utf-8').split('\0')
copied = []
for name in sorted(filter(None, tracked)):
    relative = Path(name)
    if relative.parts[:2] == ('public', 'downloads') and relative.name not in (server_name, 'Quest-Servidor-Windows.sha256'):
        continue
    if any(part in ('.git', '.local', 'node_modules', '__pycache__') for part in relative.parts):
        raise SystemExit('Arquivo privado/cache encontrado nos fontes: ' + name)
    if relative.name.startswith('.env') and relative.name not in ('.env.example', '.env.sample'):
        raise SystemExit('Configuracao privada encontrada: ' + name)
    original = ROOT / relative
    if original.is_symlink():
        raise SystemExit('Link simbolico precisa de revisao: ' + name)
    if original.is_file():
        target = source / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, target)
        if digest(original) != digest(target):
            raise SystemExit('A copia falhou: ' + name)
        copied.append(name)

editor_target = source / '.local/ragnarok/archives' / editor['archive']
editor_target.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(editor_archive, editor_target)
client_target = developer / 'Dados-do-cliente'
client_target.mkdir()
for record in client_lock['files']:
    shutil.copy2(client_directory / record['name'], client_target / record['name'])
    if digest(client_target / record['name']) != record['sha256']:
        raise SystemExit('A copia dos dados do cliente falhou: ' + record['name'])
write(developer / 'PREPARAR SERVIDOR.ps1', '''$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'Codigo-fonte'
$env:PATH = (Join-Path $env:ProgramFiles 'Docker\\Docker\\resources\\bin') + ';' + $env:PATH
$destination = Join-Path $root '.local\\ragnarok\\windows-server'
$launcher = Join-Path $destination 'Quest-Servidor\\IniciarServidor.ps1'
if (-not (Test-Path -LiteralPath $launcher)) {
    $archive = Join-Path $root 'public\\downloads\\Quest-Servidor-Windows.zip'
    $checksum = ((Get-Content -LiteralPath (Join-Path $root 'public\\downloads\\Quest-Servidor-Windows.sha256') -Raw) -split '\\s+')[0]
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $checksum) { throw 'O pacote do servidor falhou na verificacao.' }
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    Expand-Archive -LiteralPath $archive -DestinationPath $destination
}
$client = Join-Path $destination 'Quest-Servidor\\context\\.local\\ragnarok\\client'
New-Item -ItemType Directory -Force -Path $client | Out-Null
$records = (Get-Content -LiteralPath (Join-Path $root 'client\\ragnarok\\kro.lock.json') -Raw | ConvertFrom-Json).files
foreach ($record in $records) {
    $sourceFile = Join-Path $PSScriptRoot ('Dados-do-cliente\\' + $record.name)
    if ((Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.sha256) { throw ('Dados divergentes: ' + $record.name) }
    $destinationFile = Join-Path $client $record.name
    if (Test-Path -LiteralPath $destinationFile) {
        if ((Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.sha256) { throw ('O arquivo existente foi preservado: ' + $record.name) }
    } else { Copy-Item -LiteralPath $sourceFile -Destination $destinationFile }
}
& (Join-Path $root 'scripts\\IniciarServidorWindows.ps1') -Public
''')
write(developer / 'PREPARAR SERVIDOR.cmd', '@echo off\nsetlocal\nset "PSModulePath=%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\Modules;%ProgramFiles%\\WindowsPowerShell\\Modules"\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0PREPARAR SERVIDOR.ps1"\nif errorlevel 1 pause\n')
for filename, extra in [('EDITAR MAPA.cmd', ''), ('APLICAR MAPA.cmd', ' -Aplicar')]:
    write(developer / filename, '@echo off\ncall "%~dp0Codigo-fonte\\scripts\\EditarVilaWindows.cmd"' + extra + '\n')
shutil.copy2(ROOT / 'docs/pacotes-jogador-e-desenvolvedor.md', developer / 'LEIA-ME.md')
write(developer / 'LEIA-ME.txt', '''CINZAS DE ERIDAN — DESENVOLVEDOR / GM

PREPARAR SERVIDOR.cmd: prepara um servidor independente neste PC.
Instale e abra Docker Desktop com WSL2/containers Linux antes de executar.
Os dados graficos e de audio ja acompanham Dados-do-cliente (aproximadamente 4 GB).
Internet ainda e necessaria para imagens Docker, preparacao de dependencias e tunel.
O script mostra um endereco publico temporario para este novo servidor.
Ele NAO troca o servidor principal do portal. Contas e personagens sao separados.

EDITAR MAPA.cmd: prepara e abre o BrowEdit 3.660 incluido no pacote.
Abra Codigo-fonte\\content\\eridan\\data\\er_chama0.rsw.
APLICAR MAPA.cmd: valida e aplica os mapas no servidor deste PC.

Mapa: Codigo-fonte\\content\\eridan\\data
Modelos: Codigo-fonte\\content\\eridan\\data\\model\\eridan
Texturas: Codigo-fonte\\content\\eridan\\data\\texture\\eridan
Historia/missoes: Codigo-fonte\\content\\eridan e Codigo-fonte\\rathena
Guia completo: Codigo-fonte\\docs\\editar-chama-viva.md
Previa do mapa: Codigo-fonte\\docs\\images\\chama-viva-v2.png

Todos os fontes versionados foram copiados, com suas licencas, exceto
instaladores antigos e duplicados da pasta public/downloads.
Os fontes de componentes externos adicionais sao obtidos nas revisoes/SHA
registrados nos arquivos lock. O runtime preparado e o BrowEdit acompanham
fisicamente este pacote, junto dos GRFs, musica e arquivos base verificados.
Nao acompanham senhas, tokens, contas ou bancos privados.
Para desenvolvimento web, instale Node.js e siga README.md/package.json.
Para retomar o fluxo Git, clone https://github.com/empresaexemplo9-gif/Quest
e transfira suas alteracoes. Esta copia nao contem o historico .git.
''')
write(destination / 'LEIA-ME.txt', 'JOGADOR: instalador e acesso ao jogo principal.\nDESENVOLVEDOR: codigo, servidor independente e arquivos editaveis.\nEnvie o ZIP correspondente ao papel de cada pessoa.\n')

summary = {'sourceRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), 'sourceFiles': len(copied), 'packages': []}
for folder in (player, developer):
    files = [p for p in sorted(folder.rglob('*')) if p.is_file()]
    manifest = {p.relative_to(folder).as_posix(): {'bytes': p.stat().st_size, 'sha256': digest(p)} for p in files}
    write(folder / 'ARQUIVOS-SHA256.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    zip_path = destination / (folder.name + '.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for path in sorted(folder.rglob('*')):
            if path.is_file():
                # GRFs and original ZIPs already contain compressed resources.
                method = zipfile.ZIP_STORED if path.parent == client_target else zipfile.ZIP_DEFLATED
                archive.write(path, path.relative_to(destination).as_posix(), compress_type=method)
    with zipfile.ZipFile(zip_path) as archive:
        if archive.testzip() is not None:
            raise SystemExit('ZIP corrompido: ' + str(zip_path))
        for relative, record in manifest.items():
            with archive.open(folder.name + '/' + relative) as stream:
                if hashlib.file_digest(stream, 'sha256').hexdigest() != record['sha256']:
                    raise SystemExit('Arquivo incorreto no ZIP: ' + relative)
    summary['packages'].append({'folder': folder.name, 'files': len(manifest), 'uncompressedBytes': sum(x['bytes'] for x in manifest.values()), 'zipBytes': zip_path.stat().st_size, 'sha256': digest(zip_path)})
write(destination / 'PACOTES.json', json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps({'destination': str(destination), **summary}, ensure_ascii=False))
