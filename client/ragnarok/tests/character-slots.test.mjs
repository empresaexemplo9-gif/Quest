import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindCharacterSlots} from '../mods/CharacterSlotsQuest.js';
function fixture(){
 const element=()=>({events:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.events[k]=v;}});
 const cells=Array.from({length:3},element),calls=[];let button,blocked=false;
 globalThis.document={createElement:element};
 const root={querySelectorAll:()=>cells,querySelector:()=>({after:b=>button=b})};
 bindCharacterSlots(root,{select:i=>calls.push(['select',i]),create:()=>calls.push(['create']),occupied:i=>i===0,available:i=>i<2,blocked:()=>blocked});
 return {cells,calls,button,block:()=>blocked=true};
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
