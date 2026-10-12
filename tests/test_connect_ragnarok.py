#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('connect_public',ROOT/'deploy/ragnarok/connect_public.py')
connector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(connector)

# Deliberately fictitious fixture values, never used by a running service.
ENV = b'MARIADB_ROOT_PASSWORD=fixture-root\nMARIADB_PASSWORD=fixture-db\nQUEST_INTER_PASSWORD=fixture-inter\nQUEST_RO_PUBLIC_URL=https://localhost:13443\nQUEST_RO_ALLOWED_ORIGINS=https://localhost:13443\nQUEST_NATIVE_HOST=localhost\nQUEST_BIND_ADDRESS=127.0.0.1\nQUEST_PRIVATE_PORT=13005\n'

class ConnectionTests(unittest.TestCase):
    def test_public_origin_requires_an_internet_hostname(self):
        for value in ['http://game.example','https://127.0.0.1','https://192.168.1.2','https://localhost','https://test.local','https://game.example/path','https://user:secret@game.example','https://game.example?token=x']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                connector.public_origin(value)
        self.assertEqual(connector.public_origin('https://game.example/'),'https://game.example')

    def test_connection_preserves_credentials_private_bind_and_internal_origin(self):
        updated = connector.updated_environment(ENV,'https://game.example')
        self.assertIn(b'MARIADB_ROOT_PASSWORD=fixture-root\n',updated)
        self.assertIn(b'MARIADB_PASSWORD=fixture-db\n',updated)
        self.assertIn(b'QUEST_INTER_PASSWORD=fixture-inter\n',updated)
        self.assertIn(b'QUEST_NATIVE_HOST=localhost\n',updated)
        self.assertIn(b'QUEST_BIND_ADDRESS=127.0.0.1\n',updated)
        self.assertIn(b'QUEST_PRIVATE_PORT=13005\n',updated)
        self.assertIn(b'QUEST_RO_ALLOWED_ORIGINS=https://localhost:13443,https://game.example\n',updated)
        self.assertEqual(connector.updated_environment(updated,'https://game.example'),updated)

    def test_unreachable_endpoint_never_changes_deployment(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)
            (directory/'.env').write_bytes(ENV)
            with patch('sys.argv',['connect_public','--backend-url','https://game.example','--deployment',tmp]), patch.object(connector,'probe',side_effect=RuntimeError('unreachable')), patch.object(connector.subprocess,'run') as run:
                with self.assertRaises(SystemExit) as error:
                    connector.main()
                self.assertEqual(error.exception.code,1)
                run.assert_not_called()
            self.assertEqual((directory/'.env').read_bytes(),ENV)

    def test_failed_public_login_restores_configuration_and_keeps_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            deployment=root/'deployment'
            deployment.mkdir()
            (deployment/'compose.yaml').write_text('services: {}\n')
            (deployment/'.env').write_bytes(ENV)
            release=root/'public/releases'
            release.mkdir(parents=True)
            manifest=release/'ragnarok-server.json'
            original=b'{"server":null}\n'
            manifest.write_bytes(original)
            with patch('sys.argv',['connect_public','--backend-url','https://game.example','--deployment',str(deployment)]), patch.object(connector,'ROOT',root), patch.object(connector,'probe'), patch.object(connector.subprocess,'run',side_effect=[None,RuntimeError('WSS login failed'),None]) as run:
                with self.assertRaises(SystemExit) as error:
                    connector.main()
                self.assertEqual(error.exception.code,1)
                self.assertEqual(run.call_count,3)
            self.assertEqual((deployment/'.env').read_bytes(),ENV)
            self.assertEqual(manifest.read_bytes(),original)
            self.assertEqual((deployment/'.env').stat().st_mode&0o777,0o600)

if __name__ == '__main__':
    unittest.main()
