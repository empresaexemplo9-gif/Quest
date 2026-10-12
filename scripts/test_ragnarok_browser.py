#!/usr/bin/env python3
"""Exercise native SQL login, PIN, a real map and mouse/touch walking in Chromium."""
import importlib.util
import argparse
from pathlib import Path
import secrets
import time
from playwright.sync_api import sync_playwright

helper = Path('/workspace/.quest-env/manage.py')
spec = importlib.util.spec_from_file_location('quest_native', helper)
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
artifacts = Path('/workspace/.quest-env/run')


def cleanup(account, character):
    for field, value in [('char_id', character), ('account_id', account)]:
        tables = native.sql(f"SELECT table_name FROM information_schema.columns WHERE table_schema='ragnarok' AND column_name='{field}';").splitlines()
        for table in tables:
            if table.isidentifier():
                native.sql(f'DELETE FROM `{table}` WHERE `{field}`={value};', 'ragnarok')


def check(browser, label, touch):
    username = 'native_' + secrets.token_hex(4)
    password = secrets.token_hex(10)
    account = int(native.sql(f"INSERT INTO login(userid,user_pass,sex,email,pincode,pincode_change) VALUES ('{username}','{password}','M','smoke@example.invalid','1234',{int(time.time())}); SELECT LAST_INSERT_ID();", 'ragnarok'))
    character = None
    context = None
    try:
        character = int(native.sql(f"INSERT INTO `char`(account_id,char_num,name,class,base_level,job_level,str,agi,vit,`int`,dex,luk,hp,max_hp,sp,max_sp,hair,last_map,last_x,last_y,save_map,save_x,save_y,sex) VALUES ({account},0,'Quest Test {account}',1,10,5,10,10,10,10,10,10,150,150,40,40,1,'prontera',150,150,'prontera',150,150,'M'); SELECT LAST_INSERT_ID();", 'ragnarok'))
        options = {'viewport': {'width': 1180 if touch else 1280, 'height': 820 if touch else 900}, 'has_touch': touch, 'is_mobile': touch}
        if touch:
            options['user_agent'] = 'Mozilla/5.0 (iPad; CPU OS 26_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
        context = browser.new_context(**options)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:3005/', wait_until='networkidle')
        page.get_by_text('START NOW', exact=True).click()
        page.locator('#user').fill(username)
        page.locator('#pass').fill(password)
        page.locator('.connect').click()
        page.locator('.btn.num1').wait_for()
        for digit in '1234':
            page.locator('.btn.num' + digit).click()
        page.locator('.btn2.ok').click()
        page.locator('.btn.num1').wait_for(state='hidden', timeout=10000)
        page.keyboard.press('Enter')
        page.locator('.chatmode').wait_for(state='visible', timeout=30000)
        page.wait_for_timeout(1800)
        assert not errors, errors
        page.screenshot(path=str(artifacts / ('ragnarok-' + label + '-map.png')))
        if touch:
            page.touchscreen.tap(720, 475)
            page.wait_for_timeout(300)
            guide = page.locator('#guideCloseButton')
            if guide.is_visible():
                guide.tap()
                page.touchscreen.tap(720, 475)
        else:
            page.mouse.click(780, 520)
        page.wait_for_timeout(2200)
        assert not errors, errors
        page.screenshot(path=str(artifacts / ('ragnarok-' + label + '-walk.png')))
        context.close()
        context = None
        time.sleep(1)
        position = native.sql(f'SELECT last_map,last_x,last_y FROM `char` WHERE char_id={character};', 'ragnarok').split('\t')
        assert position[0] == 'prontera', position
        assert position[1:] != ['150', '150'], 'Click/tap did not produce a persisted native movement'
        print(label + ': PASS SQL login, PIN, real Prontera resources, walking and persisted position.', flush=True)
    finally:
        if context:
            context.close()
        time.sleep(.5)
        if character:
            cleanup(account, character)
        else:
            native.sql(f'DELETE FROM login WHERE account_id={account};', 'ragnarok')


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--device', choices=['both', 'desktop', 'ipad'], default='both')
args = parser.parse_args()
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    try:
        if args.device in ['both', 'desktop']:
            check(browser, 'desktop', False)
        if args.device in ['both', 'ipad']:
            check(browser, 'ipad-emulation', True)
    finally:
        browser.close()
