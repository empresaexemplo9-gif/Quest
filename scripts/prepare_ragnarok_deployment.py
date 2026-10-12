#!/usr/bin/env python3
"""Prepare a secret-free, compiled Quest deployment for an x86-64 Linux VPS."""
import argparse
import os
from pathlib import Path
import secrets
import shutil
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--backend-url', required=True)
parser.add_argument('--local-test', action='store_true')
parser.add_argument('--output', type=Path, default=ROOT / '.local/ragnarok/deployment')
args = parser.parse_args()
url = urlparse(args.backend_url)
if url.scheme not in ['http','https'] or not url.hostname or url.username or url.password or url.path not in ['', '/']:
    parser.error('An origin URL without credentials or a path is required')
if not args.local_test and url.scheme != 'https':
    parser.error('Public deployment requires HTTPS')
output = args.output.resolve()
context = output / 'context'
if context.exists():
    parser.error('Existing deployment preserved; use it instead of replacing it')
context.mkdir(parents=True)

def copy(source, target, exclude=()):
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, target, ignore=shutil.ignore_patterns('node_modules','__pycache__','.git','.env','.env.*','logs',*exclude))
    else:
        if source.suffix == '.grf':
            os.link(source, target)
        else:
            shutil.copy2(source, target)
        target.chmod(0o644 | (source.stat().st_mode & 0o111))

engine = ROOT / 'engine/rathena'
for name in ['conf','db','npc','sql-files']:
    copy(engine / name, context / 'engine/rathena' / name, exclude=['import'] if name == 'conf' else [])
shutil.rmtree(context / 'engine/rathena/conf/import', ignore_errors=True)
(context / 'engine/rathena/conf/import').mkdir()
for name in ['login','char','map','web']:
    copy(engine / (name+'-server'), context / 'engine/rathena' / (name+'-server'))
for name in ['rathena','client/ragnarok','deploy/ragnarok']:
    copy(ROOT / name, context / name)
shutil.copytree(ROOT / 'client/ragnarok/node_modules', context / 'client/ragnarok/node_modules')
base = ROOT / '.local/ragnarok'
for name in ['data.grf','rdata.grf','BGM','System','AI']:
    source = base / 'client' / name
    if source.exists(): copy(source, context / '.local/ragnarok/client' / name)
copy(base / 'overlays/english/data', context / '.local/ragnarok/overlays/english/data')
copy(base / 'vendor/RemoteClient', context / '.local/ragnarok/vendor/RemoteClient')
shutil.copytree(base / 'vendor/RemoteClient/node_modules', context / '.local/ragnarok/vendor/RemoteClient/node_modules')
shutil.rmtree(context / '.local/ragnarok/vendor/RemoteClient/data', ignore_errors=True)
copy(base / 'vendor/roBrowserLegacy/dist/Web', context / '.local/ragnarok/vendor/roBrowserLegacy/dist/Web')
copy(base / 'vendor/roBrowserLegacy/LICENSE', context / '.local/ragnarok/vendor/roBrowserLegacy/LICENSE')
copy(engine / 'LICENSE', context / 'engine/rathena/LICENSE')
libraries = context / 'runtime-libs'; libraries.mkdir()
for name in ['libpcre.so.3','libmariadb.so.3']:
    paths = [p for root in [Path('/workspace/.quest-env/root/lib'),Path('/workspace/.quest-env/root/usr/lib')] for p in root.rglob(name)]
    if not paths: raise RuntimeError('Required runtime library is missing: '+name)
    shutil.copyfile(paths[0], libraries / name)
for name in ['libz.so.1','libstdc++.so.6','libgcc_s.so.1','libssl.so.3','libcrypto.so.3','libzstd.so.1']:
    shutil.copyfile(Path('/lib/x86_64-linux-gnu') / name, libraries / name)
for name in ['compose.yaml','Caddyfile','database-init.sh']:
    copy(ROOT / 'deploy/ragnarok' / name, output / name)
copy(ROOT / 'deploy/ragnarok/dockerignore', context / '.dockerignore')
for item in context.rglob('*'):
    if item.is_dir():
        item.chmod(0o755)
    elif not item.is_symlink():
        item.chmod(0o644 | (item.stat().st_mode & 0o111))
env = output / '.env'
host = 'localhost' if args.local_test else url.hostname
allowed = args.backend_url.rstrip('/') + ',https://quest-game-plum.vercel.app'
values = {'QUEST_NATIVE_HOST':host,'QUEST_RO_PUBLIC_URL':args.backend_url.rstrip('/'),'QUEST_RO_ALLOWED_ORIGINS':allowed,'CLIENT_PUBLIC_URL':args.backend_url.rstrip('/'),'MARIADB_ROOT_PASSWORD':secrets.token_hex(32),'MARIADB_PASSWORD':secrets.token_hex(32),'QUEST_INTER_PASSWORD':secrets.token_hex(11)}
if args.local_test: values.update(QUEST_BIND_ADDRESS='127.0.0.1',QUEST_HTTP_PORT='13080',QUEST_HTTPS_PORT='13443')
if not env.exists():
    descriptor=os.open(env,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(descriptor,'w') as stream:
        stream.write('\n'.join(k+'='+v for k,v in values.items())+'\n')
print('Secret-free image context prepared. Runtime credentials are separate in the protected .env file.')
print('Start from', output, 'with docker compose up --build -d.')
