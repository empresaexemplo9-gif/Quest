#!/usr/bin/env python3
"""Fetch pinned Ragnarok tools and prepare the real client inside Quest."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.local/ragnarok'
LOCK = json.loads((ROOT / 'client/ragnarok/components.lock.json').read_text())


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def prepare(component):
    archive = BASE / 'archives' / component['archive']
    target = BASE / component['destination']
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        partial = archive.with_suffix(archive.suffix + '.part')
        try:
            with urllib.request.urlopen(component['url'], timeout=90) as response, partial.open('wb') as stream:
                total = 0
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > component['bytes']:
                        raise ValueError('Download exceeds the pinned archive size')
                    stream.write(chunk)
            if partial.stat().st_size != component['bytes'] or digest(partial) != component['sha256']:
                raise ValueError('Download does not match the pinned SHA-256')
            os.replace(partial, archive)
        finally:
            partial.unlink(missing_ok=True)
    if archive.stat().st_size != component['bytes'] or digest(archive) != component['sha256']:
        raise ValueError('Retained archive does not match the pinned SHA-256: ' + archive.name)
    marker = target / '.quest-component.json'
    if marker.exists() and json.loads(marker.read_text())['sha256'] != component['sha256']:
        raise ValueError('Existing component version differs; preserved: ' + str(target))
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=BASE) as temporary:
            temporary = Path(temporary)
            if component['kind'] == 'source':
                with tarfile.open(archive) as container:
                    container.extractall(temporary, filter='data')
                children = list(temporary.iterdir())
                if len(children) != 1 or not children[0].is_dir():
                    raise ValueError('Source archive must contain one root directory')
                os.replace(children[0], target)
            else:
                with zipfile.ZipFile(archive) as container:
                    for entry in container.infolist():
                        parts = Path(entry.filename.replace('\\', '/')).parts
                        if entry.filename.startswith(('/', '\\')) or '..' in parts or ':' in entry.filename:
                            raise ValueError('Unsafe archive entry')
                        if entry.external_attr >> 16 & 0o170000 == 0o120000:
                            raise ValueError('Symbolic links are not allowed in tool packages')
                    container.extractall(temporary)
                os.replace(temporary, target)
    marker.write_text(json.dumps({'sha256': component['sha256'], 'url': component['url']}) + '\n')
    return component['name'] + ': verified and available'


def translation():
    source = BASE / 'vendor/ROenglishRE/Translation/Renewal/data'
    target = BASE / 'overlays/english/data'
    if not target.exists():
        shutil.copytree(source, target)
    # This is a separate local overlay. The original translation stays intact.
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<clientinfo><servicetype>korea</servicetype><servertype>primary</servertype><connection><display>Quest - Cinzas de Eridan</display><address>127.0.0.1</address><port>6900</port><version>55</version><langtype>1</langtype></connection></clientinfo>\n'
    for name in ('clientinfo.xml', 'sclientinfo.xml'):
        (target / name).write_text(xml)
    print('Renewal English overlay prepared for the local Quest server.')


def build_web():
    source = BASE / 'vendor/roBrowserLegacy'
    cache = Path(os.environ.get('QUEST_NPM_CACHE', str(ROOT / '.local/npm-cache')))
    npm = ['npm', '--cache', str(cache)]
    pinned = ROOT / 'client/ragnarok/robrowser-package-lock.json'
    existing = source / 'package-lock.json'
    if existing.exists() and json.loads(existing.read_text()) != json.loads(pinned.read_text()):
        raise ValueError('Existing roBrowser lock differs; refusing to overwrite it')
    shutil.copyfile(pinned, existing)
    subprocess.run(npm + ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=source, check=True)
    subprocess.run(npm + ['run', 'build', '--', '-O', '-T', '-H'], cwd=source, check=True)
    config = {
        'development': False, 'remoteClient': '/remote-client/', 'skipIntro': False,
        'skipServerList': True, 'packetDump': False, 'BGMFileExtension': ['mp3'],
        'clientVersionMode': 'PacketVer', 'calculateHash': False,
        'servers': [{'display': 'Quest - Cinzas de Eridan', 'address': '127.0.0.1',
                     'port': 6900, 'version': 55, 'langtype': 1, 'packetver': LOCK['packetver'],
                     'renewal': True, 'packetKeys': False, 'socketProxy': 'ws://127.0.0.1:3005',
                     'forceUseAddress': True, 'remoteClient': '/remote-client/'}]
    }
    # Replace generated demo defaults, so there is no connection to another game.
    (source / 'dist/Web/Config.js').write_text('window.ROConfigBase = ' + json.dumps(config, indent=2) + ';\n')
    subprocess.run(npm + ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=ROOT / 'client/ragnarok', check=True)
    remote = BASE / 'vendor/RemoteClient'
    remote_lock = ROOT / 'client/ragnarok/remote-package-lock.json'
    existing_remote_lock = remote / 'package-lock.json'
    if existing_remote_lock.exists() and json.loads(existing_remote_lock.read_text()) != json.loads(remote_lock.read_text()):
        raise ValueError('Existing RemoteClient lock differs; preserved')
    shutil.copyfile(remote_lock, existing_remote_lock)
    subprocess.run(npm + ['ci', '--ignore-scripts', '--omit=optional', '--no-audit', '--no-fund'], cwd=remote, check=True)
    resources = remote / 'resources'
    resources.mkdir(exist_ok=True)
    (resources / 'DATA.INI').write_text('[Data]\n0=' + str(BASE / 'client/rdata.grf') + '\n1=' + str(BASE / 'client/data.grf') + '\n')
    print('Real roBrowser build prepared. Game assets are still required to enter a map.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build-web', action='store_true')
    args = parser.parse_args()
    BASE.mkdir(parents=True, exist_ok=True)
    failed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        jobs = {executor.submit(prepare, c): c['name'] for c in LOCK['components']}
        for job in concurrent.futures.as_completed(jobs):
            try:
                print(job.result(), flush=True)
            except Exception as error:
                failed.append(jobs[job])
                print(jobs[job] + ': ' + str(error), flush=True)
    if failed:
        raise SystemExit('Setup incomplete: ' + ', '.join(failed))
    translation()
    if args.build_web:
        build_web()
    print('Tool preparation complete. No kRO GRF or Windows game executable was downloaded.')


if __name__ == '__main__':
    main()
