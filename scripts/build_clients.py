#!/usr/bin/env python3
"""Package the complete original game assets into Windows/macOS clients."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import urlparse
import zipfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--go', required=True, help='Verified Go 1.24+ compiler')
parser.add_argument('--site', default='https://quest-game-plum.vercel.app')
parser.add_argument('--linux', action='store_true', help='Also build a local verification client')
args = parser.parse_args()
origin = urlparse(args.site)
if origin.scheme != 'https' or not origin.netloc or origin.username or origin.password or origin.path not in ('', '/') or origin.query or origin.fragment or any(c.isspace() for c in args.site):
    parser.error('--site must be an HTTPS origin without credentials')
version = subprocess.check_output([args.go, 'version'], text=True)
if not version.startswith('go version go1.'):
    parser.error('The specified executable is not the Go compiler')
assets = ROOT / 'desktop/assets'
assets.mkdir(parents=True, exist_ok=True)
for filename in ('index.html', 'mark.svg', 'sw.js', 'manifest.webmanifest', 'downloads.html'):
    shutil.copy2(ROOT / 'public' / filename, assets / filename)
for folder in ('game', 'icons', 'art'):
    shutil.copytree(ROOT / 'public' / folder, assets / folder, dirs_exist_ok=True)
output = ROOT / 'public/downloads'
output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='eridan-build-') as temporary:
    build = Path(temporary)
    platforms = [('windows', 'amd64'), ('darwin', 'amd64'), ('darwin', 'arm64')]
    if args.linux:
        platforms.append(('linux', 'amd64'))
    binaries = {}
    for system, architecture in platforms:
        binary = build / f'eridan-{system}-{architecture}'
        flags = f'-s -w -X main.portalURL={args.site.rstrip("/")}'
        if system == 'windows':
            flags += ' -H windowsgui'
        environment = dict(os.environ, GOOS=system, GOARCH=architecture, CGO_ENABLED='0', GOTOOLCHAIN='local')
        subprocess.run([args.go, 'build', '-trimpath', '-ldflags', flags, '-o', str(binary), '.'], cwd=ROOT / 'desktop', env=environment, check=True)
        binaries[(system, architecture)] = binary
    shutil.copy2(binaries[('windows', 'amd64')], output / 'Eridan-Setup.exe')
    with zipfile.ZipFile(output / 'Eridan-macOS.zip', 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        prefix = 'Cinzas de Eridan.app/Contents/'
        for architecture in ('amd64', 'arm64'):
            entry = zipfile.ZipInfo(prefix + 'MacOS/eridan-' + architecture)
            entry.external_attr = 0o100755 << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, binaries[('darwin', architecture)].read_bytes())
        launcher = '#!/bin/sh\nset -eu\neridan_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\ncase "$(uname -m)" in\n arm64) exec "$eridan_dir/eridan-arm64" ;;\n x86_64) exec "$eridan_dir/eridan-amd64" ;;\n *) exit 1 ;;\nesac\n'
        entry = zipfile.ZipInfo(prefix + 'MacOS/Eridan')
        entry.external_attr = 0o100755 << 16
        archive.writestr(entry, launcher)
        archive.writestr(prefix + 'Info.plist', '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Eridan</string><key>CFBundleIdentifier</key><string>online.quest.eridan</string><key>CFBundleName</key><string>Cinzas de Eridan</string><key>CFBundleShortVersionString</key><string>1.3.0</string><key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>11.0</string></dict></plist>')
        archive.writestr('LEIA-ME.txt', 'Cinzas de Éridan · cliente original completo\nAbra Cinzas de Eridan.app. Uma cópia é instalada em ~/Applications.\nO aplicativo usa seu navegador para desenhar o jogo e salva uma cópia local do progresso.\nIntel e Apple Silicon. Este aplicativo ainda não foi assinado nem notarizado pela Apple.\nA jornada solo funciona offline. O mundo online exige o servidor do projeto.\n')
    if args.linux:
        local_build = ROOT / 'desktop/build'
        local_build.mkdir(parents=True, exist_ok=True)
        shutil.copy2(binaries[('linux', 'amd64')], local_build / 'eridan.next')
        os.replace(local_build / 'eridan.next', local_build / 'eridan')
checksums = {name: hashlib.sha256((output / name).read_bytes()).hexdigest() for name in ('Eridan-Setup.exe', 'Eridan-macOS.zip')}
(output / 'SHA256SUMS.json').write_text(json.dumps(checksums, indent=2) + '\n')
release = {'name': 'Cinzas de Éridan', 'version': '1.3.0', 'engine': 'eridan-original', 'site': args.site.rstrip('/'), 'clientIncluded': True, 'signed': False, 'files': [{'name': name, 'url': '/downloads/' + name, 'sha256': checksum, 'bytes': (output / name).stat().st_size} for name, checksum in checksums.items()]}
(ROOT / 'public/releases/client.json').write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')
print('Original Windows x64 and macOS Intel/Apple Silicon clients packaged with all game assets.')
print('Cross-compiled successfully; signing and native platform execution require separate verification.')
