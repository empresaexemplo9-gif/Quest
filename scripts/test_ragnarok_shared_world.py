#!/usr/bin/env python3
"""Prove two actual Ragnarok clients share presence, chat and movement on rAthena."""
import argparse
from pathlib import Path
import secrets
import struct
import subprocess
import time
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--site', default='http://127.0.0.1:38777/play')
parser.add_argument('--deployment', type=Path, default=Path('.local/ragnarok/deployment'))
parser.add_argument('--artifacts', type=Path, default=Path('/workspace/.quest-env/run'))
args = parser.parse_args()
args.artifacts.mkdir(parents=True, exist_ok=True)

def sql(query, database='ragnarok'):
    result = subprocess.run(['docker', 'compose', 'exec', '-T', 'database', 'bash', '-c',
        'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot --batch --skip-column-names "$@"',
        'quest-shared-smoke', database], input=query, text=True, capture_output=True,
        check=True, cwd=args.deployment)
    return result.stdout.strip()

def cleanup(account, character):
    for field, value in [('char_id', character), ('account_id', account)]:
        tables = sql(f"SELECT table_name FROM information_schema.columns WHERE table_schema='ragnarok' AND column_name='{field}';").splitlines()
        for table in tables:
            if table.isidentifier():
                sql(f'DELETE FROM `{table}` WHERE `{field}`={value};')

players = []
contexts = []
try:
    for number in range(2):
        user, password = 'shared_' + secrets.token_hex(4), secrets.token_hex(10)
        account = int(sql(f"INSERT INTO login(userid,user_pass,sex,email,pincode,pincode_change) VALUES ('{user}','{password}','M','smoke@example.invalid','1234',{int(time.time())}); SELECT LAST_INSERT_ID();"))
        player = {'account': account, 'user': user, 'password': password, 'char': None}
        players.append(player)
        player['char'] = int(sql(f"INSERT INTO `char`(account_id,char_num,name,class,base_level,job_level,str,agi,vit,`int`,dex,luk,hp,max_hp,sp,max_sp,hair,last_map,last_x,last_y,save_map,save_x,save_y,sex) VALUES ({account},0,'Shared Test {account}',1,10,5,10,10,10,10,10,10,150,150,40,40,1,'prontera',{150+number},150,'prontera',{150+number},150,'M'); SELECT LAST_INSERT_ID();"))
    for player in players:
        sql(f"INSERT INTO skill(char_id,id,lv,flag) VALUES ({player['char']},1,9,0);")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for player in players:
            context = browser.new_context(viewport={'width': 1280, 'height': 900})
            contexts.append(context)
            page = context.new_page()
            player.update(page=page, frames=[], errors=[])
            page.on('pageerror', lambda error, p=player: p['errors'].append(str(error)))
            page.on('websocket', lambda ws, p=player: ws.on('framereceived', lambda payload: p['frames'].append(payload)))
            page.goto(args.site + '/', wait_until='networkidle')
            page.screenshot(path=str(args.artifacts / 'ragnarok-shared-login.png'))
            print('Opening native login for player', len(contexts), flush=True)
            page.get_by_text('START NOW', exact=True).click()
            page.locator('#user').fill(player['user'])
            page.locator('#pass').fill(player['password'])
            page.locator('.connect').click()
            page.locator('.btn.num1').wait_for()
            for digit in '1234':
                page.locator('.btn.num' + digit).click()
            page.locator('.btn2.ok').click()
            page.locator('.btn.num1').wait_for(state='hidden')
            page.keyboard.press('Enter')
            page.locator('.chatmode').wait_for(state='visible', timeout=45000)
            page.wait_for_timeout(1800)
            page.screenshot(path=str(args.artifacts / f'ragnarok-shared-player{len(contexts)}-joined.png'))
            print('Player', len(contexts), 'entered Prontera', flush=True)
            guide = page.locator('#guideCloseButton')
            if guide.is_visible():
                guide.click()
            assert not player['errors'], player['errors']
        online = sql('SELECT account_id,last_map,online FROM `char` WHERE account_id IN (' + ','.join(str(p['account']) for p in players) + ') ORDER BY account_id;').splitlines()
        assert len(online) == 2 and all(row.endswith('\tprontera\t1') for row in online), online
        first, second = players
        chat = 'QuestShared' + secrets.token_hex(6)
        first['page'].keyboard.press('Enter')
        first['page'].locator('.input-chatbox').fill(chat)
        first['page'].locator('.input-chatbox').press('Enter')
        second['page'].get_by_text(chat, exact=False).first.wait_for(state='visible', timeout=15000)
        assert any(isinstance(frame, bytes) and chat.encode() in frame for frame in second['frames']), 'Chat did not arrive from the shared server'
        start = len(second['frames'])
        first['page'].mouse.click(780, 520)
        first['page'].wait_for_timeout(2400)
        # Actor GID in native move packet is the account ID, not the character ID.
        aid = struct.pack('<I', first['account'])
        movements = [frame for frame in second['frames'][start:] if isinstance(frame, bytes) and any(frame[index:index+2] == b'\xfd\x09' and frame[index+5:index+9] == aid for index in range(len(frame)-8))]
        assert movements, 'The second client did not receive the first player movement'
        for command, action in [('/sit', 2), ('/stand', 3)]:
            start = len(second['frames'])
            first['page'].locator('.input-chatbox').fill(command)
            first['page'].locator('.input-chatbox').press('Enter')
            first['page'].wait_for_timeout(1000)
            actions = [frame for frame in second['frames'][start:] if isinstance(frame, bytes) and any(
                frame[index:index+2] == b'\xc8\x08' and frame[index+2:index+6] == aid and frame[index+29] == action
                for index in range(len(frame)-29))]
            assert actions, f'The second client did not receive native {command}'
        for number, player in enumerate(players, 1):
            assert not player['errors'], player['errors']
            player['page'].screenshot(path=str(args.artifacts / f'ragnarok-shared-player{number}.png'))
        for context in contexts:
            context.close()
        contexts.clear()
        time.sleep(1)
        position = sql(f"SELECT last_map,last_x,last_y FROM `char` WHERE char_id={first['char']};").split('\t')
        assert position[0] == 'prontera' and position[1:] != ['150', '150'], position
        proof = {'engine': 'rAthena', 'renderer': 'roBrowserLegacy', 'playersSimultaneous': 2,
                 'map': 'prontera', 'chatBroadcast': True, 'movementBroadcast': True,
                 'positionPersisted': True, 'sitAndStandBroadcast': True, 'site': args.site, 'executedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        import json
        (args.artifacts / 'ragnarok-shared-result.json').write_text(json.dumps(proof, indent=2) + '\n')
        print('PASS: two native clients in Prontera, real shared chat, movement, sitting/standing broadcast and MariaDB persistence.', flush=True)
        browser.close()
finally:
    for context in contexts:
        try:
            context.close()
        except Exception:
            pass
    time.sleep(.5)
    for player in players:
        if player['char']:
            cleanup(player['account'], player['char'])
        else:
            sql(f"DELETE FROM login WHERE account_id={player['account']};")
