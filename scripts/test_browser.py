#!/usr/bin/env python3
"""Functional Chromium checks; iPad viewport/touch emulation, not real hardware."""
import argparse
import json
from pathlib import Path
import time
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--site', default='http://127.0.0.1:3002')
parser.add_argument('--desktop-client', default='http://127.0.0.1:38477')
parser.add_argument('--output', type=Path, default=Path('/workspace/.quest-env/run'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
results = []

def player(page):
    return page.evaluate("() => {const save=JSON.parse(localStorage.getItem('eridan-solo-v1'));return save.world.players[save.playerId];}")

def persist(page):
    page.evaluate("window.dispatchEvent(new Event('beforeunload'))")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width, height, label in [(1440, 1000, 'desktop'), (820, 1180, 'ipad-portrait'), (1180, 820, 'ipad-landscape')]:
        print('Checking '+label, flush=True)
        context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=label.startswith('ipad'), is_mobile=label.startswith('ipad'))
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.site)
        page.locator('#class-cards .class-card').last.wait_for()
        assert page.locator('#class-cards .class-card').count() == 5
        page.locator('#character-name').fill('AriTeste')
        page.locator('#new-game').click()
        page.locator('#hud').wait_for(state='visible')
        page.locator('#interact-button').click()
        page.get_by_role('button', name='Receber missão · O Despertar').click()
        page.locator('#modal-close').click()
        assert 'Coletar' in page.locator('#quest-objectives').inner_text()
        persist(page)
        before = player(page)['x']
        if label.startswith('ipad'):
            direction = page.locator('[data-direction=right]')
            assert direction.is_visible()
            rectangle = direction.bounding_box()
            assert rectangle['width'] >= 44 and rectangle['height'] >= 44
            cdp = context.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': rectangle['x']+rectangle['width']/2, 'y': rectangle['y']+rectangle['height']/2}]})
            page.wait_for_timeout(850)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        else:
            page.keyboard.down('d')
            page.wait_for_timeout(850)
            page.keyboard.up('d')
        persist(page)
        assert player(page)['x'] > before+80, label+' did not move'
        settled = player(page)['x']
        page.wait_for_timeout(350)
        persist(page)
        assert abs(player(page)['x']-settled) < 2, 'movement remained stuck after release'
        page.screenshot(path=str(args.output / ('eridan-'+label+'.png')))
        # A complete local journey returns after reload and offline navigation.
        page.evaluate('navigator.serviceWorker.ready')
        page.reload()
        page.locator('#continue-game').wait_for(state='visible')
        page.locator('#continue-game').click()
        page.locator('#hud').wait_for(state='visible')
        assert page.locator('#player-name').inner_text() == 'AriTeste'
        page.wait_for_function('!!navigator.serviceWorker.controller')
        context.set_offline(True)
        page.reload()
        page.locator('#continue-game').click()
        page.locator('#hud').wait_for(state='visible')
        assert player(page)['campaign']['active'] == 'wake'
        assert not errors, errors
        results.append(label+': class selection, quest, movement/release, reload and offline save passed')
        context.close()

    print('Checking browser multiplayer', flush=True)
    # Real authenticated shared world in two isolated browser cookie jars.
    contexts = [browser.new_context() for _ in range(2)]
    pages = [context.new_page() for context in contexts]
    suffix = str(int(time.time()*1000))
    names = ['Ari'+suffix[-7:], 'Nyra'+suffix[-7:]]
    chat = 'A Chama Viva resiste. '+suffix
    for index, page in enumerate(pages):
        page.goto(args.site)
        page.locator('#character-name').fill(names[index])
        page.locator('#online-game').click()
        page.locator('[name=username]').fill('browser'+suffix+str(index))
        page.locator('[name=password]').fill('browser-test-password')
        page.locator('[name=operation]').select_option('register')
        page.locator('#online-form button').click()
        page.locator('#hud').wait_for(state='visible')
    pages[0].locator('#chat-input').fill(chat)
    pages[0].locator('#chat-form button').click()
    pages[1].locator('#event-log').get_by_text(names[0]+': '+chat, exact=True).wait_for()
    pages[0].locator('[data-panel=social]').click()
    pages[0].locator('.list-row').filter(has_text=names[1]).locator('[data-command=inviteParty]').last.click()
    pages[1].locator('[data-panel=social]').click()
    pages[1].get_by_role('button', name='Aceitar', exact=True).click()
    pages[1].locator('#modal-body').get_by_text('2 Despertos no grupo. O líder inicia as operações.', exact=True).wait_for()
    results.append('two browser accounts: registration, shared chat and accepted party passed')
    for context in contexts:
        context.close()

    print('Checking embedded desktop client', flush=True)
    # Use the actual Linux build of the same embedded Windows/macOS client.
    context = browser.new_context()
    page = context.new_page()
    page.goto(args.desktop_client)
    page.locator('#character-name').fill('AriEmpacotado')
    page.locator('#new-game').click()
    page.wait_for_timeout(200)
    if page.locator('#confirm-new').count():
        page.locator('#confirm-new').click()
    page.locator('#hud').wait_for(state='visible')
    persist(page)
    page.wait_for_timeout(250)
    response = context.request.get(args.desktop_client+'/api/local-save')
    assert response.ok and response.json()['format'] == 'eridan-save'
    # Recover the native file backup when the browser storage has been cleared.
    page.evaluate("localStorage.removeItem('eridan-solo-v1')")
    page.reload()
    page.locator('#continue-game').wait_for(state='visible')
    page.locator('#continue-game').click()
    page.locator('#hud').wait_for(state='visible')
    assert page.locator('#player-name').inner_text() == 'AriEmpacotado'
    results.append('embedded desktop client: gameplay, native save and backup recovery passed')
    context.close()
    browser.close()

(args.output/'eridan-browser-results.json').write_text(json.dumps(results, indent=2)+'\n')
for result in results:
    print('PASS: '+result)
