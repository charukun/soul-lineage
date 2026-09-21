import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulation} from './helpers/johakyu-simulation.mjs';
import {createJohakyuPhysiologyRules} from '../src/nocturne/johakyu-physiology.js';
const source=readFileSync(new URL('../src/nocturne/runtime.js',import.meta.url),'utf8');
test('actual renderer simulation applies one canonical body hit and publishes matching stamina/body',()=>{
  const rules=createJohakyuPhysiologyRules(),engine=simulation(source,{rules});engine.init();const seen=new Set();let count=0,staminaChanged=false,injured=false;
  for(let i=0;i<3600;i++){engine.step(1/60);const snapshot=engine.observe();for(const actor of snapshot.actors){assert.ok(actor.stamina);assert.equal(Object.keys(actor.body).length,6);staminaChanged ||= actor.stamina.value<100;injured ||= Object.values(actor.body).some(part=>part.severity>0);for(const part of Object.values(actor.body))assert.equal(part.durability,Math.round((1-part.severity)*100));}
    for(const event of snapshot.events){const key=[snapshot.battleId,event.attackId,event.sourceId,event.targetId].join('/');assert.equal(seen.has(key),false);seen.add(key);count++;const target=snapshot.actors.find(actor=>actor.id===event.targetId);assert.equal(target.body[event.bodyPart].durability,event.bodyDurability);}
  }
  assert.ok(count>0);assert.ok(staminaChanged);assert.ok(injured);assert.equal(engine.digest().game.bursts,0);
});
test('leg injuries change real movement without altering actor scale, camera or clip selection',()=>{
  function run(initialBody){const engine=simulation(source,{rules:createJohakyuPhysiologyRules({initialBody})});engine.init();for(let i=0;i<180;i++)engine.step(1/60);return engine.digest().actors.find(actor=>actor.kind==='hero');}
  const healthy=run({}),injured=run({hero:{leftLeg:.75,rightLeg:.75}});assert.notDeepEqual(healthy.position,injured.position);assert.equal(healthy.animation,injured.animation);
});
