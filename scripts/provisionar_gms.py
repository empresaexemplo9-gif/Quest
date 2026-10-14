#!/usr/bin/env python3
"""Provision explicitly supplied GM accounts in the existing native database.

Input is a private JSON file, never included in release packages. Existing
accounts are preserved unless they already belong to this same GM profile.
"""
import argparse
import json
import re
import subprocess
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--credentials', type=Path, required=True)
parser.add_argument('--runtime', type=Path, required=True)
parser.add_argument('--docker', required=True)
parser.add_argument('--origin', default='https://quest-game-plum.vercel.app')
parser.add_argument('--server', default='http://127.0.0.1:13905')
parser.add_argument('--promote-existing', action='store_true', help='Promove apenas contas cuja senha fornecida foi autenticada no servidor nativo.')
parser.add_argument('--set-requested-password', action='store_true', help='Aplica a senha explicitamente solicitada a uma conta existente, com copia privada do registro anterior no banco.')
args = parser.parse_args()
accounts = json.loads(args.credentials.read_text(encoding='utf-8'))
if not isinstance(accounts, list) or not accounts:
    raise SystemExit('Lista de contas ausente.')
for row in accounts:
    if not re.fullmatch(r'[A-Za-z0-9_]{4,21}', row.get('username', '')):
        raise SystemExit('Nome de usuario invalido.')
    if not re.fullmatch(r'[!-~]{8,23}', row.get('password', '')):
        raise SystemExit('Senha fora dos limites do protocolo nativo.')
    if not isinstance(row.get('alias'), str) or not 1 <= len(row['alias']) <= 40:
        raise SystemExit('Identificacao GM invalida.')
if len({row['username'] for row in accounts}) != len(accounts):
    raise SystemExit('Usuarios repetidos.')

def sql(query):
    run = subprocess.run([args.docker, 'compose', 'exec', '-T', 'database', 'bash', '-c',
        'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot --batch --skip-column-names ragnarok'],
        cwd=args.runtime, input=query, text=True, capture_output=True)
    if run.returncode:
        # SQL errors can echo credential literals. Never return stderr.
        raise SystemExit('Falha na operacao do banco. Nenhuma credencial foi exibida.')
    return run.stdout.rstrip('\r\n')

def literal(value):
    return "CONVERT(0x" + value.encode('utf-8').hex() + " USING utf8mb4)"

def authenticate(row):
    request = urllib.request.Request(args.server + '/api/account',
        data=json.dumps({'action':'login','username':row['username'],'password':row['password']}).encode(),
        headers={'Content-Type':'application/json','Origin':args.origin}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            reply = json.load(response)
            if reply.get('ok') is not True or reply.get('username') != row['username']:
                raise ValueError('native authentication')
    except Exception:
        raise SystemExit('Autenticacao nativa precisa ser revisada; senha existente preservada: ' + row['username'])

sql('''CREATE TABLE IF NOT EXISTS quest_gm_profile (
    account_id INT UNSIGNED NOT NULL PRIMARY KEY,
    alias VARCHAR(40) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;''')
# Preflight the entire list before mutating any login account.
existing = {}
for row in accounts:
    answer = sql(f"SELECT l.account_id,l.group_id,COALESCE(p.alias,'') FROM login l LEFT JOIN quest_gm_profile p ON p.account_id=l.account_id WHERE BINARY l.userid={literal(row['username'])};")
    if answer:
        fields = answer.split('\t')
        if len(fields) != 3:
            raise SystemExit('Perfil de conta invalido.')
        if fields[1] != '98' or fields[2] != row['alias']:
            if args.set_requested_password and not fields[2]:
                pass
            elif args.promote_existing and not fields[2]:
                authenticate(row)
            else:
                raise SystemExit('Existe uma conta com esse usuario. Conta existente preservada: ' + row['username'])
        if fields[2] and fields[2] != row['alias']:
            raise SystemExit('Existe uma conta com esse usuario. Conta existente preservada: ' + row['username'])
        existing[row['username']] = int(fields[0])

for row in accounts:
    username = row['username']
    if username not in existing:
        identifier = int(sql(f"""START TRANSACTION;
            INSERT INTO login (userid,user_pass,sex,email,group_id,character_slots)
            VALUES ({literal(username)},{literal(row['password'])},'M','gm@example.invalid',98,15);
            SET @quest_gm_id=LAST_INSERT_ID();
            INSERT INTO quest_gm_profile (account_id,alias) VALUES (@quest_gm_id,{literal(row['alias'])});
            COMMIT; SELECT @quest_gm_id;"""))
    else:
        identifier = existing[username]
        if args.set_requested_password:
            sql(f"CREATE TABLE IF NOT EXISTS quest_gm_login_backup LIKE login; INSERT IGNORE INTO quest_gm_login_backup SELECT * FROM login WHERE account_id={identifier}; UPDATE login SET user_pass={literal(row['password'])} WHERE account_id={identifier};")
        sql(f"START TRANSACTION; UPDATE login SET group_id=98,character_slots=GREATEST(character_slots,15) WHERE account_id={identifier}; INSERT INTO quest_gm_profile(account_id,alias) VALUES ({identifier},{literal(row['alias'])}) ON DUPLICATE KEY UPDATE alias=VALUES(alias); COMMIT;")
    authenticate(row)
    print(row['alias'] + ': conta GM criada; login nativo confirmado; personagens preservados.')
