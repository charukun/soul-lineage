import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileStore} from '@soul/raid/profile';
import {RaidSession} from '@soul/raid';
import {playableCharacter,selectCharacter} from '../src/characters.js';

function fixture(){let raw=null;return new ProfileStore({getItem:()=>raw,setItem:(_,value)=>{raw=value;}},()=> 'character-test',()=>100);}
test('legacy profiles keep their original creature and unknown appearance ids remain recoverable',()=>{
  const store=fixture(),before=store.read();
  assert.equal(playableCharacter(before).id,'night-creature');
  assert.deepEqual(store.read(),before);
  store.change(p=>{p.character='future-character';});
  assert.equal(playableCharacter(store.read()).id,'night-creature');
  assert.equal(store.read().character,'future-character');
});
test('selecting the reaper persists without changing visits, memories, form or combat rules',()=>{
  const store=fixture();store.claim({id:'one-way-village',name:'訪問済み'});store.unlock('smith');store.unlock('hunter');
  store.change(p=>{p.form='brute';});
  const before=store.read(),village={id:'battle-fixture',name:'test',seed:7,target:'traveller',level:1,weather:'fog',source:'generated'};
  const oldGame=new RaidSession(village,before);
  selectCharacter(store,'silver-reaper');const after=store.read();
  assert.equal(playableCharacter(after).name,'白銀の鎌姫');
  assert.deepEqual({...after,character:undefined,revision:before.revision},{...before,character:undefined});
  const newGame=new RaidSession(village,after);
  assert.equal(newGame.getMaxHP(),oldGame.getMaxHP());assert.deepEqual(newGame.skillSet(),oldGame.skillSet());
  assert.throws(()=>store.claim({id:'one-way-village'}));
  store.finish('one-way-village','escaped',0);store.equip('hunter',0);
  assert.equal(playableCharacter(store.read()).id,'silver-reaper');
  selectCharacter(store,'night-creature');assert.equal(store.read().form,'brute');
});
test('invalid selection and storage failures never report a successful change',()=>{
  const store=fixture(),before=store.read();assert.throws(()=>selectCharacter(store,'__proto__'));assert.deepEqual(store.read(),before);
  const raw=JSON.stringify(before),blocked=new ProfileStore({getItem:()=>raw,setItem:()=>{throw new Error('full');}});
  assert.throws(()=>selectCharacter(blocked,'silver-reaper'));assert.deepEqual(blocked.read(),before);
});
