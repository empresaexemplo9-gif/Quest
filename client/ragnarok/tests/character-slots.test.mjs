import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindCharacterSlots} from '../mods/CharacterSlotsQuest.js';
function fixture(){
 const element=()=>({events:{},attributes:{},children:[],append(...items){this.children.push(...items);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.events[k]=v;}});
 const cells=Array.from({length:3},element),calls=[],occupied=new Set([0]);let toolbar,blocked=false,selected=1,deleting=false;
 globalThis.document={createElement:element};
 const root={querySelectorAll:()=>cells,querySelector:()=>({after:b=>toolbar=b})};
 const controls=bindCharacterSlots(root,{select:i=>{selected=i;calls.push(['select',i]);},create:()=>calls.push(['create']),connect:()=>{calls.push(['connect',selected]);blocked=true;},current:()=>selected,deleting:()=>deleting,occupied:i=>occupied.has(i),available:i=>i<2,blocked:()=>blocked});
 return {cells,calls,button:toolbar.children[1],enter:toolbar.children[0],controls,block:()=>blocked=true,scheduled:()=>deleting=true,created:()=>occupied.add(1)};
}
test('one touch-compatible click on an empty slot selects it and opens creation',()=>{
 const f=fixture();f.cells[1].events.click();assert.deepEqual(f.calls,[['select',1],['create']]);
});
test('occupied slot selects without connecting or creating, unavailable slots are ignored',()=>{
 const f=fixture();f.cells[0].events.click();f.cells[2].events.click();assert.deepEqual(f.calls,[['select',0]]);
});
test('explicit create button chooses the first available empty slot and blocks during requests',()=>{
 const f=fixture();f.button.events.click();assert.deepEqual(f.calls,[['select',1],['create']]);f.block();f.button.events.click();assert.equal(f.calls.length,2);
});
test('keyboard activation is accessible and prevents a duplicate default action',()=>{
 const f=fixture();let prevented=false;f.cells[1].events.keydown({key:'Enter',preventDefault(){prevented=true;},stopPropagation(){}});assert.equal(prevented,true);assert.deepEqual(f.calls,[['select',1],['create']]);
});
test('an existing selected character enters once through the native connect action',()=>{
 const f=fixture();assert.equal(f.enter.disabled,true);f.cells[0].events.click();assert.equal(f.enter.disabled,false);f.enter.events.click();f.enter.events.click();assert.deepEqual(f.calls,[['select',0],['connect',0]]);assert.equal(f.enter.disabled,true);
});
test('empty and deletion-reserved slots never request a game connection',()=>{
 const f=fixture();f.enter.events.click();assert.deepEqual(f.calls,[]);f.cells[0].events.click();f.scheduled();f.controls.refresh();assert.equal(f.enter.disabled,true);f.enter.events.click();assert.deepEqual(f.calls,[['select',0]]);
});
test('server refresh after character creation enables entry without requiring another selection',()=>{
 const f=fixture();assert.equal(f.enter.disabled,true);f.created();f.controls.refresh();assert.equal(f.enter.disabled,false);f.enter.events.click();assert.deepEqual(f.calls,[['connect',1]]);
});
