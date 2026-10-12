#!/usr/bin/env python3
"""Configure a downloaded native server package without replacing database credentials."""
import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parent)
parser.add_argument('--tunnel-origin', help='Public HTTPS origin while preserving the existing private gateway')
parser.add_argument('--origin', help='Local/LAN HTTP origin or public HTTPS origin')
parser.add_argument('--verify-client', action='store_true')
args = parser.parse_args()
root = args.directory.resolve()
if not (root/'context/deploy/ragnarok/Dockerfile').is_file():
    parser.error('Extract the complete Quest server package before configuring it')
env_file = root/'.env'
values = {}
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if line and not line.startswith('#'):
            key,value = line.split('=',1)
            if not re.fullmatch(r'[A-Z_0-9]+',key):parser.error('Unsupported configuration key')
            values[key] = value
    for key,length in [('MARIADB_ROOT_PASSWORD',64),('MARIADB_PASSWORD',64),('QUEST_INTER_PASSWORD',22)]:
        if not re.fullmatch('[a-f0-9]{'+str(length)+'}',values.get(key,'')):
            parser.error('Existing credentials are incomplete; configuration and database were preserved')
else:
    values.update(MARIADB_ROOT_PASSWORD=secrets.token_hex(32),MARIADB_PASSWORD=secrets.token_hex(32),QUEST_INTER_PASSWORD=secrets.token_hex(11))
if args.tunnel_origin and (args.origin or not env_file.exists()):
    parser.error('Start the existing server before applying a tunnel origin; do not combine --origin')
origin = args.tunnel_origin or args.origin or values.get('QUEST_RO_PUBLIC_URL','http://localhost:8080')
url = urlparse(origin)
if url.scheme not in ['http','https'] or not url.hostname or url.username or url.password or url.path not in ['', '/'] or url.query or url.fragment or any(c.isspace() for c in origin):
    parser.error('Use a complete HTTP/HTTPS origin without credentials, path, query or fragment')
local = url.hostname == 'localhost'
private = local
try:
    ip = ipaddress.ip_address(url.hostname)
    if ip.version != 4:parser.error('Use an IPv4 address or a hostname for this server package')
    local = ip.is_loopback
    private = local or any(ip in ipaddress.ip_network(cidr) for cidr in ['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'] if ip.version == 4)
except ValueError:
    pass
try:
    port = url.port or (443 if url.scheme == 'https' else 80)
except ValueError:
    parser.error('Invalid port')
if args.tunnel_origin and (url.scheme != 'https' or private):
    parser.error('The tunnel origin must be a public HTTPS hostname')
if url.scheme == 'http' and not private:
    parser.error('Public access requires HTTPS; HTTP is allowed only on localhost/private IPv4 LAN')
if url.scheme == 'https' and port != 443:
    parser.error('Public HTTPS uses port 443; forward ports 80/443 to this computer')
if url.scheme == 'https' and url.hostname.endswith('.vercel.app'):
    parser.error('Keep the Vercel domain as the entry; use a hostname pointing to this PC for the backend')
origin = origin.rstrip('/')
if args.tunnel_origin:
    allowed=list(dict.fromkeys(values.get('QUEST_RO_ALLOWED_ORIGINS',values['QUEST_RO_PUBLIC_URL']).split(',')+[origin]))
    values.update(QUEST_RO_PUBLIC_URL=origin,CLIENT_PUBLIC_URL=origin,QUEST_RO_ALLOWED_ORIGINS=','.join(allowed))
else:
    values.update(QUEST_RO_PUBLIC_URL=origin,CLIENT_PUBLIC_URL=origin,
        QUEST_RO_ALLOWED_ORIGINS=origin+',https://quest-game-plum.vercel.app',
        QUEST_NATIVE_HOST=('http://' if url.scheme == 'http' else '')+url.hostname,
        QUEST_BIND_ADDRESS='127.0.0.1' if local else '0.0.0.0',
        QUEST_HTTP_PORT=str(port if url.scheme == 'http' else 80),QUEST_HTTPS_PORT='18443' if url.scheme == 'http' else '443',
        QUEST_PRIVATE_PORT=values.get('QUEST_PRIVATE_PORT','13905'))
temporary = root/'.env.next'
descriptor = os.open(temporary,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
try:
    with os.fdopen(descriptor,'w') as stream:
        stream.write('\n'.join(key+'='+value for key,value in values.items())+'\n')
    os.replace(temporary,env_file)
finally:
    if temporary.exists():temporary.unlink()
env_file.chmod(0o600)
if args.verify_client:
    client = root/'context/.local/ragnarok/client'
    lock = json.loads((root/'context/client/ragnarok/kro.lock.json').read_text())
    for entry in lock['files']:
        path = client/entry['name']
        if not path.is_file() or path.stat().st_size != entry['bytes']:
            parser.error('Complete verified client file is missing: '+entry['name'])
        with path.open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest() != entry['sha256']:
                parser.error('Client integrity check failed: '+entry['name'])
    for name in ['BGM.zip','dll_exe.zip']:
        if not (client/('.'+name+'.extracted')).is_file():parser.error('Client archive has not been extracted: '+name)
    for path in client.rglob('*'):
        if path.is_dir():path.chmod(0o755)
        elif not path.is_symlink():path.chmod(0o644)
    print('Client files verified against the pinned SHA-256 hashes.')
print('Quest native server configured at '+origin+'. Existing database credentials preserved.')
