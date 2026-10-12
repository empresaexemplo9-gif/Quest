#!/usr/bin/env python3
"""Download the complete kRO mirror listed by RateMyServer and verify SHA-256."""
import concurrent.futures
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import time
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.local/ragnarok/client'
LOCK = json.loads((ROOT / 'client/ragnarok/kro.lock.json').read_text())
CHUNK = 16 * 1024 * 1024


class DownloadLink(HTMLParser):
    url = None

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == 'a' and attributes.get('id') == 'downloadButton':
            self.url = attributes.get('href')


def sha256(filename):
    with filename.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def download(entry):
    filename = BASE / entry['name']
    expected = entry['bytes']
    if filename.exists():
        if filename.stat().st_size == expected and sha256(filename) == entry['sha256']:
            return {'name': entry['name'], 'status': 'verified', 'bytes': expected, 'sha256': entry['sha256']}
        raise ValueError('Existing client file differs; preserved: ' + entry['name'])
    with urllib.request.urlopen(entry['page'], timeout=40) as response:
        parser = DownloadLink()
        parser.feed(response.read(3 * 1024 * 1024).decode())
    if not parser.url or not parser.url.startswith('https://'):
        raise ValueError('A public HTTPS download link was not provided')
    partial = filename.with_suffix(filename.suffix + '.part')
    with urllib.request.urlopen(urllib.request.Request(parser.url, headers={'Range': 'bytes=0-63'}), timeout=40) as response:
        if response.status != 206 or response.headers.get('Content-Range') != f'bytes 0-63/{expected}':
            raise ValueError('Mirror does not support the expected ranged download')
    descriptor = os.open(partial, os.O_CREAT | os.O_RDWR | os.O_TRUNC, 0o600)
    os.ftruncate(descriptor, expected)
    started = time.monotonic()
    completed = 0
    reported = 0

    def segment(offset):
        end = min(expected - 1, offset + CHUNK - 1)
        position = offset
        for attempt in range(4):
            request = urllib.request.Request(parser.url, headers={'Range': f'bytes={position}-{end}'})
            with urllib.request.urlopen(request, timeout=90) as stream:
                if stream.status != 206 or stream.headers.get('Content-Range') != f'bytes {position}-{end}/{expected}':
                    raise ValueError('Incorrect range response from the mirror')
                while block := stream.read(1024 * 1024):
                    if position + len(block) > end + 1:
                        raise ValueError('Range exceeds the expected size')
                    written = os.pwrite(descriptor, block, position)
                    if written != len(block):
                        raise OSError('Short file write')
                    position += written
            if position == end + 1:
                break
        if position != end + 1:
            raise ValueError(f'Truncated download range: {position-offset}/{end-offset+1} bytes')
        return end - offset + 1

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            for size in executor.map(segment, range(0, expected, CHUNK)):
                completed += size
                if completed - reported >= 512 * 1024 * 1024:
                    reported = completed
                    print(entry['name'], round(completed / expected * 100), '%', round(completed / (time.monotonic() - started) / 1024 / 1024, 1), 'MiB/s', flush=True)
    finally:
        os.close(descriptor)
    if partial.stat().st_size != expected or sha256(partial) != entry['sha256']:
        raise ValueError('Download failed the expected size or SHA-256 verification')
    if entry['name'].endswith('.grf'):
        with partial.open('rb') as stream:
            if stream.read(15) != b'Master of Magic':
                raise ValueError('Invalid GRF signature')
    os.replace(partial, filename)
    return {'name': entry['name'], 'status': 'verified', 'bytes': expected, 'sha256': entry['sha256']}


def main():
    BASE.mkdir(parents=True, exist_ok=True)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        jobs = {executor.submit(download, entry): entry['name'] for entry in LOCK['files']}
        for job in concurrent.futures.as_completed(jobs):
            try:
                result = job.result()
            except Exception as error:
                result = {'name': jobs[job], 'error': str(error)}
            results.append(result)
            print(json.dumps(result), flush=True)
    (BASE / 'download-status.json').write_text(json.dumps(results, indent=2) + '\n')
    if any('error' in result for result in results):
        raise SystemExit('The complete client download has not finished successfully.')
    for archive_name in ('dll_exe.zip', 'BGM.zip'):
        marker = BASE / ('.' + archive_name + '.extracted')
        if marker.exists():
            continue
        with zipfile.ZipFile(BASE / archive_name) as archive:
            for entry in archive.infolist():
                relative = Path(entry.filename.replace('\\', '/'))
                if relative.is_absolute() or '..' in relative.parts or ':' in entry.filename:
                    raise ValueError('Unsafe client archive entry')
                if entry.external_attr >> 16 & 0o170000 == 0o120000:
                    raise ValueError('Client archive symbolic links are not allowed')
                if (BASE / relative).exists() and not entry.is_dir():
                    raise ValueError('Existing client file preserved: ' + entry.filename)
            archive.extractall(BASE)
        marker.write_text('Verified archive extracted without overwriting existing client files.\n')


if __name__ == '__main__':
    main()
