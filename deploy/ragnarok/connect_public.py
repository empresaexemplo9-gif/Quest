#!/usr/bin/env python3
"""Activate the existing world's public URL only after trusted HTTPS/WSS native login."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import ssl
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


def public_origin(value):
    url = urllib.parse.urlparse(value)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.path not in ['', '/'] or url.query or url.fragment or any(c.isspace() for c in value):
        raise ValueError('Use a public HTTPS origin, without credentials or a path')
    if url.port not in [None,443] or '.' not in url.hostname or url.hostname.endswith(('.local','.internal','.localhost')):
        raise ValueError('Use a public hostname with trusted HTTPS')
    try:
        ipaddress.ip_address(url.hostname)
    except ValueError:
        return 'https://' + url.hostname
    raise ValueError('Use a public hostname, not a local IP address')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        raise ValueError('The native endpoint must answer directly, without redirecting')


def probe(origin):
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    with opener.open(origin + '/api/readiness', timeout=15) as response:
        if response.status != 200:
            raise ValueError('Native server did not return HTTP 200')
        result = json.loads(response.read(8192))
    if not all([result.get('engine') == 'rAthena', result.get('renderer') == 'roBrowserLegacy',
                result.get('packetver') == 20211103, result.get('assetsReady') is True,
                result.get('nativeReady') is True]):
        raise ValueError('The selected endpoint does not offer the actual ready Ragnarok world')


def atomic_write(path, data, mode):
    descriptor, name = tempfile.mkstemp(prefix='.quest-connect-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            os.fchmod(stream.fileno(), mode)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def updated_environment(data, origin):
    lines = data.decode().splitlines()
    values = dict(line.split('=',1) for line in lines if line and not line.startswith('#'))
    required = ['MARIADB_ROOT_PASSWORD','MARIADB_PASSWORD','QUEST_INTER_PASSWORD','QUEST_RO_PUBLIC_URL']
    if any(not values.get(key) for key in required):
        raise ValueError('Existing deployment configuration is incomplete; preserved')
    origins = list(dict.fromkeys([*values.get('QUEST_RO_ALLOWED_ORIGINS',values['QUEST_RO_PUBLIC_URL']).split(','), origin]))
    updates = {'QUEST_RO_PUBLIC_URL':origin,'CLIENT_PUBLIC_URL':origin,'QUEST_RO_ALLOWED_ORIGINS':','.join(origins)}
    output = []
    for line in lines:
        key = line.split('=',1)[0]
        output.append(key+'='+updates.pop(key) if key in updates else line)
    output.extend(key+'='+value for key,value in updates.items())
    return ('\n'.join(output)+'\n').encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend-url', required=True)
    parser.add_argument('--deployment', type=Path, default=ROOT/'.local/ragnarok/deployment')
    parser.add_argument('--verify-only', action='store_true', help='Check native readiness without changing files')
    args = parser.parse_args()
    try:
        origin = public_origin(args.backend_url)
        probe(origin)
        if args.verify_only:
            print('PASS: trusted public HTTPS and actual Ragnarok readiness. No files changed.')
            return
        deployment = args.deployment.resolve()
        if not (deployment/'compose.yaml').is_file():
            raise ValueError('Select the existing native deployment directory')
        env_file = deployment/'.env'
        original = env_file.read_bytes()
        changed = updated_environment(original, origin)
        try:
            atomic_write(env_file, changed, 0o600)
            subprocess.run(['docker','compose','up','-d','--no-build','game'],cwd=deployment,check=True)
            deadline = time.monotonic()+90
            while True:
                try:
                    probe(origin)
                    break
                except Exception:
                    if time.monotonic() >= deadline:
                        raise
                    time.sleep(1)
            subprocess.run(['python3',str(ROOT/'scripts/test_ragnarok_deployment.py'),
                            '--deployment',str(deployment),'--origin',origin],cwd=ROOT,check=True)
            manifest_file = ROOT/'public/releases/ragnarok-server.json'
            manifest = json.loads(manifest_file.read_text())
            manifest.update(server=origin,status='public-native-login-verified')
            atomic_write(manifest_file,(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode(),0o644)
        except Exception:
            atomic_write(env_file, original, 0o600)
            subprocess.run(['docker','compose','up','-d','--no-build','game'],cwd=deployment,check=True)
            raise
        print('PASS: public native SQL login over HTTPS/WSS. World and credentials preserved.')
        print('Updated public/releases/ragnarok-server.json. Commit and push main to connect the existing Vercel portal and installers.')
    except Exception as error:
        parser.exit(1,'Connection was not activated: '+str(error)+'\n')


if __name__ == '__main__':
    main()
