import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleObservation} from '../src/johakyu-observation.js';
const actor=(id,side='hero')=>({id,side,position:[1,0,2],hp:20,maxHp:30,dead:false,phase:null,animation:'Idle'});
const frame=()=>({authority:'native-demo',battleId:'boot-1:round-1',timeSeconds:1,status:'battle',actors:[actor('hero'),actor('enemy','enemy')]});

test('observation copies only known data and never freezes or mutates its source',()=>{
  const input=frame();input.actors[0].renderer={draw(){throw Error('must not draw');}};
  const before=JSON.stringify(input),a=createBattleObservation(input),b=createBattleObservation(input);
  assert.deepEqual(a,b);assert.equal(JSON.stringify(input),before);
  assert.equal(Object.isFrozen(input.actors[0]),false);
  for(const value of [a,a.clock,a.actors,a.actors[0],a.actors[0].position,a.events])assert.ok(Object.isFrozen(value));
  assert.throws(()=>{a.actors[0].position[0]=100;},TypeError);
  input.actors[0].position[0]=20;assert.equal(a.actors[0].position[0],1);
  assert.equal('renderer' in a.actors[0],false);assert.equal(a.readOnly,true);
  assert.equal(a.clock.owner,'native-demo');assert.equal(a.actors[0].phase,null);
  for(const key of ['stamina','body','techniqueId'])assert.equal(a.actors[0][key],null);
});

test('stable owner IDs survive ordering, disappearance and successive frames',()=>{
  const input=frame(),first=createBattleObservation(input);input.actors.reverse();
  assert.equal(createBattleObservation(input).actors[0].id,first.actors[1].id);
  input.actors=input.actors.filter(row=>row.id==='enemy');
  assert.equal(createBattleObservation(input).actors[0].id,'enemy');
});

test('invalid frames are rejected rather than repaired into invented game state',()=>{
  for(const mutate of [
    row=>{row.authority='browser';},row=>{row.timeSeconds=NaN;},row=>{row.timeSeconds=-1;},
    row=>{row.actors[1].id='hero';},row=>{row.actors[0].hp=31;},row=>{row.actors[0].maxHp=0;},
    row=>{row.actors[0].position=[1,Infinity,0];},row=>{row.actors[0].phase='kyu';},
    row=>{row.actors[0].dead='false';},row=>{row.actors[0].side='unknown';}
  ]){const input=frame();mutate(input);assert.throws(()=>createBattleObservation(input),TypeError);}
});

test('semantic impact identity comes from its domain owner and duplicates fail closed',()=>{
  const input=frame();input.authority='rinne-domain';input.actors[0].phase='ha';
  const event={id:'hit-1',type:'impact',attackId:'attack-1',sourceId:'hero',targetId:'enemy',phase:'ha',techniqueId:'catalog-technique',damage:4};
  input.events=[event];const output=createBattleObservation(input);
  assert.deepEqual(output.events[0],event);assert.ok(Object.isFrozen(output.events[0]));
  assert.equal(input.actors[1].hp,20); // An observation is never a damage command.
  input.events.push({...event});assert.throws(()=>createBattleObservation(input),/Duplicate event/);
  input.events=[{...event,targetId:'absent'}];assert.throws(()=>createBattleObservation(input),/Unknown impact actor/);
  input.events=[event];input.authority='native-demo';input.actors[0].phase=null;
  assert.throws(()=>createBattleObservation(input),/Unsupported semantic event/);
});
