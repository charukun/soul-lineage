import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ProfileStore, SAVE_KEY} from '../profile.js';
import {importHousing} from '../world.js';
const storage = () => { const map = new Map(); return { getItem:k => map.get(k) ?? null, setItem:(k,v) => map.set(k,v) }; };
const village = () => ({ gameId:'village', playerId:'owner', villageId:'stable', payload:{entities:[{id:'house',type:'cottage',x:4,z:2}]} });
test('claim timestamp comes from the injected platform clock', () => {
  const s = new ProfileStore(storage(), () => 'p', () => 1234);
  s.claim({id:'v',name:'v'}); assert.equal(s.read().visits.v.enteredAt,1234);
});
test('failed admission write cannot start a hunt or erase existing visits', () => {
  const mem = storage(), s = new ProfileStore(mem, () => 'p');
  s.claim({id:'first',name:'first'});
  const before = mem.getItem(SAVE_KEY);
  mem.setItem = () => { throw Error('quota'); };
  assert.throws(() => s.claim({id:'second',name:'second'}));
  assert.equal(mem.getItem(SAVE_KEY), before);
});
test('prototype keys cannot be used as canonical admission identities', () => {
  const s = new ProfileStore(storage(), () => 'p');
  for(const id of ['__proto__','constructor','prototype']) assert.throws(() => s.claim({id}));
});
test('terminal result commits only once and cannot reopen a visit', () => {
  const s = new ProfileStore(storage(), () => 'p'); s.claim({id:'v'});
  assert.equal(s.finish('v','defeated',0),true);
  assert.equal(s.finish('v','completed',10),false);
  assert.equal(s.read().hunts,1); assert.equal(s.read().visits.v.status,'defeated');
  assert.throws(() => s.finish('v','entered',0));
});
test('invalid canonical village IDs cannot be coerced into new identities', () => {
  for(const id of [{},[],42,'',null]) { const v=village();v.villageId=id; if(id===null)v.payload.villageId={};assert.throws(() => importHousing(v)); }
});
test('duplicate entities and inherited catalog keys are rejected', () => {
  const a=village();a.payload.entities.push({...a.payload.entities[0]});assert.throws(() => importHousing(a));
  const b=village();b.payload.entities[0].type='toString';assert.throws(() => importHousing(b));
});
test('invalid profile progression fails closed without overwriting storage', () => {
  for(const mutation of [p=>p.form='unknown',p=>p.unlocked=['unknown'],p=>p.hunts=-1]) {
    const mem=storage(),s=new ProfileStore(mem,()=> 'p'),p=s.read();mutation(p);
    const raw=JSON.stringify(p);mem.setItem(SAVE_KEY,raw);assert.throws(()=>s.read());assert.equal(mem.getItem(SAVE_KEY),raw);
  }
});
