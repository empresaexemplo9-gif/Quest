#!/usr/bin/env python3
"""Build platform installers after obtaining the real public portal URL."""
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

PROJECT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site', required=True, help='Real HTTPS URL of the published Quest portal')
    parser.add_argument('--go', default=shutil.which('go'), help='Go 1.24+ compiler path')
    parser.add_argument('--output', type=Path, default=PROJECT / 'legacy' / 'build')
    args = parser.parse_args()
    url = urlparse(args.site)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.path not in ('', '/') or url.query or url.fragment or any(char.isspace() for char in args.site):
        parser.error('--site must be the real HTTPS origin, without credentials, query, or subpath')
    if not args.go:
        parser.error('Go 1.24+ is required')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='quest-build-') as temporary:
        build = Path(temporary)
        outputs = []
        for system, architecture, name in [('windows', 'amd64', 'Quest-Setup.exe'), ('darwin', 'amd64', 'install-intel'), ('darwin', 'arm64', 'install-apple-silicon')]:
            env = dict(os.environ, GOOS=system, GOARCH=architecture, CGO_ENABLED='0', GOTOOLCHAIN='local')
            binary = build / name
            command = [args.go, 'build', '-trimpath', '-ldflags', f'-s -w -X main.portalURL={args.site.rstrip("/")}/', '-o', str(binary), '.']
            subprocess.run(command, cwd=PROJECT / 'legacy' / 'ragnarok-installer', env=env, check=True)
            outputs.append(binary)
        windows_name = 'Quest-Setup.exe'
        macos_name = 'Quest-macOS.zip'
        shutil.copy2(outputs[0], output / windows_name)
        with zipfile.ZipFile(output / macos_name, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for binary in outputs[1:]:
                info = zipfile.ZipInfo('Instalar Quest.app/Contents/MacOS/' + binary.name)
                info.external_attr = 0o100755 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, binary.read_bytes())
            launcher = '#!/bin/bash\nset -e\nquest_dir="$(cd "$(dirname "$0")" && pwd)"\ncase "$(uname -m)" in\n arm64) exec "$quest_dir/install-apple-silicon" ;;\n x86_64) exec "$quest_dir/install-intel" ;;\n *) osascript -e \'display dialog "Arquitetura do Mac não suportada." with title "Quest" buttons {"OK"}\' ; exit 1 ;;\nesac\n'
            info = zipfile.ZipInfo('Instalar Quest.app/Contents/MacOS/InstalarQuest')
            info.external_attr = 0o100755 << 16
            archive.writestr(info, launcher)
            plist = '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>InstalarQuest</string><key>CFBundleIdentifier</key><string>online.quest.installer</string><key>CFBundleName</key><string>Instalar Quest</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>'
            archive.writestr('Instalar Quest.app/Contents/Info.plist', plist)
        checksums = {name:hashlib.sha256((output / name).read_bytes()).hexdigest() for name in (windows_name, macos_name)}
        (output / 'SHA256SUMS.json').write_text(json.dumps(checksums, indent=2) + '\n')
    print('Installers compiled into ' + str(output))
    print('These binaries are not signed with a Windows or Apple developer identity; native platform execution still requires verification.')

if __name__ == '__main__':
    main()
