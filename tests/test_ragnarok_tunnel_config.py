#!/usr/bin/env python3
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'deploy/ragnarok/configure_local.py'

class TunnelConfigTests(unittest.TestCase):
    def fixture(self,root):
        (root/'context/deploy/ragnarok').mkdir(parents=True)
        (root/'context/deploy/ragnarok/Dockerfile').write_text('FROM scratch\n')
        environment=("MARIADB_ROOT_PASSWORD="+'a'*64+"\nMARIADB_PASSWORD="+'b'*64+"\nQUEST_INTER_PASSWORD="+'c'*22+"\nQUEST_RO_PUBLIC_URL=http://localhost:8080\nCLIENT_PUBLIC_URL=http://localhost:8080\nQUEST_RO_ALLOWED_ORIGINS=http://localhost:8080\nQUEST_NATIVE_HOST=http://localhost\nQUEST_BIND_ADDRESS=127.0.0.1\nQUEST_HTTP_PORT=8080\nQUEST_HTTPS_PORT=18443\nQUEST_PRIVATE_PORT=13905\n")
        (root/'.env').write_text(environment)
        return environment

    def run_config(self,root,url):
        return subprocess.run(['python3',str(SCRIPT),'--directory',str(root),'--tunnel-origin',url],text=True,capture_output=True)

    def test_tunnel_keeps_credentials_loopback_and_ports_on_repeated_configuration(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);original=self.fixture(root)
            result=self.run_config(root,'https://quest.example')
            self.assertEqual(result.returncode,0,result.stderr)
            updated=(root/'.env').read_text()
            before=dict(line.split('=',1) for line in original.splitlines())
            after=dict(line.split('=',1) for line in updated.splitlines())
            for key in ['MARIADB_ROOT_PASSWORD','MARIADB_PASSWORD','QUEST_INTER_PASSWORD','QUEST_NATIVE_HOST','QUEST_BIND_ADDRESS','QUEST_HTTP_PORT','QUEST_HTTPS_PORT','QUEST_PRIVATE_PORT']:
                self.assertEqual(before[key],after[key])
            self.assertEqual(after['QUEST_RO_PUBLIC_URL'],'https://quest.example')
            self.assertEqual(after['QUEST_RO_ALLOWED_ORIGINS'],'http://localhost:8080,https://quest.example')
            self.assertEqual(self.run_config(root,'https://quest.example').returncode,0)
            self.assertEqual((root/'.env').read_text(),updated)
            self.assertEqual((root/'.env').stat().st_mode&0o777,0o600)

    def test_invalid_tunnel_keeps_existing_world_configuration(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);original=self.fixture(root)
            for url in ['http://quest.example','https://localhost','https://192.168.1.2','https://quest.example/path','https://quest-game-plum.vercel.app']:
                with self.subTest(url=url):
                    self.assertNotEqual(self.run_config(root,url).returncode,0)
                    self.assertEqual((root/'.env').read_text(),original)

if __name__=='__main__':unittest.main()
