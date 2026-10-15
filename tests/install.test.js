import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {tabletPlatform, setupInstaller} from '../public/install.js';

class Element extends EventTarget {
  constructor(dataset = {}) { super(); this.dataset = dataset; this.hidden = true; this.textContent = ''; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  click() { this.dispatchEvent(new Event('click')); }
  focus() { this.focused = true; }
  select() { this.selected = true; }
}
function fixture({ua = 'Android Chrome', standalone = false, touch = 5, query = ''} = {}) {
  const win = new EventTarget(), elements = new Map();
  for (const id of ['install-dialog','install-confirm','install-feedback','install-state','install-url','install-title','install-close','install-copy']) elements.set('#' + id, new Element());
  const buttons = ['ipad','android'].map(install => new Element({install}));
  const guides = ['ipad','android'].map(installGuide => new Element({installGuide}));
  const display = new EventTarget(); display.matches = standalone;
  const registrations = [];
  win.navigator = {userAgent:ua,maxTouchPoints:touch,standalone,serviceWorker:{register(path) { registrations.push(path); return Promise.resolve(); }}};
  win.location = {href:'https://quest.example/ragnarok.html' + query};
  win.matchMedia = () => display;
  const doc = {querySelector:selector => elements.get(selector),querySelectorAll:selector => selector === '[data-install]' ? buttons : guides};
  setupInstaller(win, doc);
  return {win, elements, buttons, guides, registrations, get:id => elements.get('#' + id)};
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function offer(state, outcome = 'dismissed') {
  const event = new Event('beforeinstallprompt', {cancelable:true});
  let prompts = 0;
  event.prompt = async () => { prompts++; };
  event.userChoice = Promise.resolve({outcome});
  state.win.dispatchEvent(event);
  return {event, prompts:() => prompts};
}

test('iPad desktop mode is recognized without treating a normal Mac as an iPad', () => {
  assert.equal(tabletPlatform({userAgent:'Macintosh Safari',maxTouchPoints:5}),'ipad');
  assert.equal(tabletPlatform({userAgent:'Macintosh Safari',maxTouchPoints:0}),'other');
  assert.equal(tabletPlatform({userAgent:'iPad Safari'}),'ipad');
  assert.equal(tabletPlatform({userAgent:'Android Chrome'}),'android');
});
test('iPad and desktop display the chosen guide without requesting Android installation', () => {
  for (const ua of ['Macintosh Safari','Windows Chrome']) {
    const state = fixture({ua}); const prompt = offer(state);
    state.buttons[0].click();
    assert.equal(state.get('install-dialog').open,true);
    assert.equal(state.guides[0].hidden,false); assert.equal(state.guides[1].hidden,true);
    state.buttons[1].click();
    assert.equal(state.guides[1].hidden,false); assert.equal(state.get('install-confirm').hidden,true);
    assert.equal(prompt.prompts(),0); assert.equal(prompt.event.defaultPrevented,false);
    state.get('install-close').click(); assert.equal(state.get('install-dialog').open,false);
  }
});
test('Android prompt is used once and dismissal keeps manual installation available', async () => {
  const state = fixture(), prompt = offer(state);
  assert.equal(prompt.event.defaultPrevented,true);
  state.buttons[1].click(); state.buttons[1].click();
  await settle();
  assert.equal(prompt.prompts(),1);
  assert.match(state.get('install-feedback').textContent,/cancelada/);
  assert.doesNotMatch(state.get('install-state').textContent,/já está instalado/);
  assert.equal(state.guides[1].hidden,false);
});
test('accepted choice is pending until actual appinstalled event; standalone is recognized', async () => {
  const state = fixture(); offer(state,'accepted'); state.buttons[1].click(); await settle();
  assert.match(state.get('install-feedback').textContent,/solicitada/);
  assert.doesNotMatch(state.get('install-state').textContent,/já está instalado/);
  state.win.dispatchEvent(new Event('appinstalled'));
  assert.match(state.get('install-state').textContent,/já está instalado/);
  assert.equal(state.get('install-confirm').hidden,true);
  const installed = fixture({standalone:true});
  assert.match(installed.get('install-state').textContent,/já está instalado/);
});
test('late Android install offer is available inside the open guide', async () => {
  const state = fixture(); state.buttons[1].click();
  assert.equal(state.get('install-confirm').hidden,true);
  const prompt = offer(state); assert.equal(state.get('install-confirm').hidden,false);
  state.get('install-confirm').click(); await settle(); assert.equal(prompt.prompts(),1);
});
test('installation links omit query secrets and clipboard denial leaves selectable address', async () => {
  const state = fixture({query:'?instalar=ipad&token=private'});
  assert.equal(state.get('install-url').value,'https://quest.example/ragnarok.html');
  assert.equal(state.guides[0].hidden,false); assert.deepEqual(state.registrations,['/sw.js']);
  state.get('install-copy').click(); await settle();
  assert.equal(state.get('install-url').selected,true);
});
test('service worker caches public UI but never intercepts account, API or remote game requests', () => {
  const listeners = {}, self = {location:{origin:'https://quest.example'},addEventListener(name,fn) { listeners[name] = fn; }};
  let intercepted;
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,Set,fetch:async()=>({ok:false}),Response});
  for (const path of ['/api/ragnarok','/api/ragnarok-account','/entrar.html','/criar-conta.html','/downloads/game.zip','https://game.example/']) {
    intercepted = false;
    listeners.fetch({request:{method:'GET',url:new URL(path,self.location.origin).href},respondWith() { intercepted = true; }});
    assert.equal(intercepted,false,path);
  }
  listeners.fetch({request:{method:'GET',url:'https://quest.example/ragnarok.html'},respondWith() { intercepted = true; }});
  assert.equal(intercepted,true);
});
