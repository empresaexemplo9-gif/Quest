import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code=readFileSync(new URL('../client/ragnarok/portal-login.js',import.meta.url),'utf8');
const origin='https://quest.example';
function fixture() {
  const messages=[],user={value:'',dispatchEvent(){}},pass={value:'',dispatchEvent(){}};
  let clicks=0,listener;
  const button={click(){clicks++;}};
  const login={querySelector(selector){return selector.startsWith('input.user') ? user : selector.startsWith('input.pass') ? pass : selector === '.connect' ? button : null;}};
  const shadow={querySelector(selector){return selector.startsWith('#WinLogin,') ? login : null;},querySelectorAll(){return [];}};
  const document={querySelector(){return null;},querySelectorAll(){return [{shadowRoot:shadow}];}};
  const parent={postMessage(data,target){messages.push({data,target});}};
  const window={parent,QUEST_PORTAL_ORIGINS:[origin],addEventListener(type,callback){if(type==='message')listener=callback;}};
  vm.runInNewContext(code,{window,document,Date,Event:class {},setInterval(){return 1;},clearInterval(){}});
  return {messages,user,pass,parent,send:event=>listener(event),clicks:()=>clicks};
}

test('login bridge ignores untrusted senders and origins',() => {
  const state=fixture(),data={type:'QUEST_LOGIN',username:'FixtureUser',password:'FixturePass123'};
  state.send({source:state.parent,origin:'https://other.example',data});
  state.send({source:{},origin,data});
  assert.equal(state.clicks(),0);assert.equal(state.pass.value,'');
});

test('login bridge reaches the native shadow DOM and acknowledges without leaking the password',() => {
  const state=fixture();
  state.send({source:state.parent,origin,data:{type:'QUEST_LOGIN',username:'FixtureUser',password:'FixturePass123'}});
  assert.equal(state.user.value,'FixtureUser');assert.equal(state.pass.value,'FixturePass123');assert.equal(state.clicks(),1);
  assert.ok(state.messages.some(item=>item.data.type==='QUEST_LOGIN_SUBMITTED' && item.target===origin));
  assert.ok(!JSON.stringify(state.messages).includes('FixturePass123'));
});
