#!/usr/bin/env python3
"""Build the actual Ragnarok player from verified, pinned client components."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local/ragnarok'
SOURCE = ROOT / 'desktop/ragnarok'
VERSION = re.search(r'const version = "([^"]+)"', (SOURCE / 'main.go').read_text()).group(1)
NODE_VERSION = 'v24.21.0'
PLATFORMS = {
    'linux': ('linux', 'amd64', 'linux-x64', '.tar.xz'),
    'windows': ('windows', 'amd64', 'win-x64', '.zip'),
    'mac-intel': ('darwin', 'amd64', 'darwin-x64', '.tar.gz'),
    'mac-apple': ('darwin', 'arm64', 'darwin-arm64', '.tar.gz'),
}

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def download(url, path):
    partial = path.with_suffix(path.suffix + '.part')
    with urllib.request.urlopen(url, timeout=120) as response, partial.open('wb') as out:
        shutil.copyfileobj(response, out)
    os.replace(partial, path)


def node_archive(platform):
    cache = LOCAL / 'player-node'
    cache.mkdir(exist_ok=True)
    _, _, target, suffix = PLATFORMS[platform]
    filename = f'node-{NODE_VERSION}-{target}{suffix}'
    lock_path = ROOT / 'desktop/ragnarok/node.lock.json'
    if lock_path.exists():
        lock = json.loads(lock_path.read_text())
        if lock['version'] != NODE_VERSION:
            raise ValueError('Node version does not match retained lock')
    else:
        url = f'https://nodejs.org/dist/{NODE_VERSION}/SHASUMS256.txt'
        with urllib.request.urlopen(url, timeout=30) as response:
            official = dict(line.split()[::-1] for line in response.read().decode().splitlines() if line.strip())
        names = [f'node-{NODE_VERSION}-{p[2]}{p[3]}' for p in PLATFORMS.values()]
        lock = {'version': NODE_VERSION, 'integritySource': url,
                'files': {name: official[name] for name in names}}
        lock_path.write_text(json.dumps(lock, indent=2) + '\n')
    archive = cache / filename
    if not archive.exists():
        download(f'https://nodejs.org/dist/{NODE_VERSION}/{filename}', archive)
    if digest(archive) != lock['files'][filename]:
        raise ValueError('Node official SHA-256 mismatch: ' + filename)
    return archive


def runtime_zip(platform):
    archive = node_archive(platform)
    assets = SOURCE / 'assets'
    assets.mkdir(exist_ok=True)
    output = assets / 'runtime.zip'
    components = json.loads((ROOT / 'client/ragnarok/components.lock.json').read_text())
    needed = ['RemoteClient', 'roBrowserLegacy', 'ROenglishRE']
    for component in components['components']:
        if component['name'] in needed:
            retained = LOCAL / 'archives' / component['archive']
            if digest(retained) != component['sha256']:
                raise ValueError('Source archive no longer matches pinned integrity')
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        def put(path, name):
            if path.is_symlink():
                raise ValueError('Symlink cannot be included: ' + str(path))
            bundle.write(path, name)
        def tree(base, prefix):
            for path in sorted(base.rglob('*')):
                if path.is_file():
                    put(path, prefix + '/' + path.relative_to(base).as_posix())
        tree(LOCAL / 'vendor/roBrowserLegacy/dist/Web', 'web')
        tree(LOCAL / 'overlays/english/data', 'english')
        remote = LOCAL / 'vendor/RemoteClient'
        tree(remote / 'src', 'remote/src')
        tree(remote / 'node_modules', 'remote/node_modules')
        for name in ['package.json', 'package-lock.json']:
            put(remote / name, 'remote/' + name)
        for name in ['README.md', 'README-pt-br.md']:
            put(remote / name, 'licenses/RemoteClient-' + name)
        for name in ['LICENSE', 'LICENSE.txt', 'LICENSE.md']:
            for component in needed:
                path = LOCAL / 'vendor' / component / name
                if path.exists():
                    put(path, f'licenses/{component}-{name}')
        for component in components['components']:
            if component['name'] in ['roBrowserLegacy', 'RemoteClient']:
                put(LOCAL / 'archives' / component['archive'], 'sources/' + component['archive'])
        put(ROOT / 'client/ragnarok/robrowser-package-lock.json', 'sources/robrowser-package-lock.json')
        put(ROOT / 'client/ragnarok/remote-package-lock.json', 'sources/remote-package-lock.json')
        put(ROOT / 'client/ragnarok/apply-browser-mods.mjs', 'sources/apply-browser-mods.mjs')
        for path in (ROOT / 'client/ragnarok/mods').glob('*.js'):
            put(path, 'sources/quest-browser-mods/' + path.name)
        for path in SOURCE.glob('*.go'):
            if not path.name.endswith('_test.go'):
                put(path, 'sources/quest-player/' + path.name)
        put(SOURCE / 'go.mod', 'sources/quest-player/go.mod')
        put(SOURCE / 'LICENSE', 'licenses/Quest-Player-GPL-3.0')
        put(ROOT / 'client/ragnarok/kro.lock.json', 'kro.lock.json')
        put(ROOT / 'client/ragnarok/components.lock.json', 'components.lock.json')
        put(SOURCE / 'start-assets.mjs', 'start-assets.mjs')
        # Extract only Node and its license, never links or arbitrary archive paths.
        if archive.suffix == '.zip':
            with zipfile.ZipFile(archive) as node:
                for entry in node.infolist():
                    name = entry.filename.split('/')[-1]
                    if entry.filename in [f'node-{NODE_VERSION}-win-x64/node.exe', f'node-{NODE_VERSION}-win-x64/LICENSE']:
                        bundle.writestr('node.exe' if name == 'node.exe' else 'licenses/Node-LICENSE', node.read(entry))
        else:
            with tarfile.open(archive) as node:
                for entry in node:
                    if entry.isfile() and (entry.name.endswith('/bin/node') or entry.name == archive.name.removesuffix('.tar.xz').removesuffix('.tar.gz') + '/LICENSE'):
                        source = node.extractfile(entry)
                        info = zipfile.ZipInfo('node' if entry.name.endswith('/bin/node') else 'licenses/Node-LICENSE')
                        info.external_attr = (0o100755 << 16)
                        info.compress_type = zipfile.ZIP_DEFLATED
                        bundle.writestr(info, source.read())
        bundle.writestr('licenses/SOURCES.json', json.dumps({
            'components': [c for c in components['components'] if c['name'] in needed],
            'node': {'version': NODE_VERSION, 'url': 'https://nodejs.org/', 'sha256': digest(archive)},
            'gameData': 'Game data is fetched from the pinned kRO sources on the player computer; it is not embedded.'}, indent=2))
    (assets / 'runtime.sha256').write_text(digest(output) + '\n')


def build(platform, go):
    runtime_zip(platform)
    goos, goarch, _, _ = PLATFORMS[platform]
    env = dict(os.environ, GOOS=goos, GOARCH=goarch, CGO_ENABLED='0', GOTOOLCHAIN='local')
    build = SOURCE / 'build'
    build.mkdir(exist_ok=True)
    binary = build / ('Quest-Ragnarok-' + platform + ('.exe' if goos == 'windows' else ''))
    command = [go, 'build', '-trimpath', '-ldflags', '-s -w' + (' -H=windowsgui' if goos == 'windows' else ''), '-o', str(binary), '.']
    subprocess.run(command, cwd=SOURCE, env=env, check=True)
    destination = ROOT / 'public/downloads'
    if platform == 'windows':
        output = destination / 'Quest-Ragnarok-Setup.exe'
        shutil.copyfile(binary, output)
    elif goos == 'darwin':
        output = destination / ('Quest-Ragnarok-macOS-' + ('Intel' if goarch == 'amd64' else 'AppleSilicon') + '.zip')
        with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
            name = 'Quest Ragnarok.app/Contents/'
            put = zipfile.ZipInfo(name + 'MacOS/Quest-Ragnarok')
            put.external_attr = 0o100755 << 16
            put.compress_type = zipfile.ZIP_DEFLATED
            bundle.writestr(put, binary.read_bytes())
            bundle.writestr(name + 'Info.plist', '<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Quest-Ragnarok</string><key>CFBundleIdentifier</key><string>app.quest.ragnarok</string><key>CFBundleName</key><string>Quest Ragnarok</string><key>CFBundleVersion</key><string>' + VERSION + '</string><key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>12.0</string></dict></plist>')
            bundle.writestr('LEIA-ME.txt', 'Extraia o ZIP e mova Quest Ragnarok.app para Aplicativos. A primeira execução baixa cerca de 4 GB de dados kRO, verificados por SHA-256. Selecione o endereço HTTPS do servidor. O jogo usa o cliente roBrowserLegacy/WebGL no navegador padrão. Aplicativo sem assinatura/notarização; macOS físico ainda não testado.\n')
    else:
        output = binary
    if output.stat().st_size >= 100 * 1024 * 1024:
        raise ValueError('Player release exceeds GitHub file limit')
    print(platform, output.stat().st_size, digest(output), flush=True)
    if platform != 'linux':
        checksum = destination / 'Quest-Ragnarok-SHA256SUMS.json'
        existing = json.loads(checksum.read_text()) if checksum.exists() else {}
        existing[output.name] = {'bytes': output.stat().st_size, 'sha256': digest(output), 'version': VERSION}
        checksum.write_text(json.dumps(existing, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', choices=[*PLATFORMS, 'all'], default='all')
    parser.add_argument('--go', default='go')
    args = parser.parse_args()
    go = str(Path(args.go).resolve()) if Path(args.go).is_file() else args.go
    for platform in PLATFORMS if args.platform == 'all' else [args.platform]:
        build(platform, go)

if __name__ == '__main__':
    main()
