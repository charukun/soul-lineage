import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulation} from './helpers/johakyu-simulation.mjs';
import {createJohakyuCatalogRules} from '../src/nocturne/johakyu-catalog.js';
const source=readFileSync(new URL('../src/nocturne/runtime.js',import.meta.url),'utf8');
test('P4 review executes registered trial clips with real canonical physiology, never a learned-skill write',()=>{
 const rules=createJohakyuCatalogRules({loadout:{ha:'action.guard-step'}}),engine=simulation(source,{rules});engine.init();
 const clips=new Set(),phases=new Set();let hits=0;
 for(let i=0;i<3600;i++){engine.step(1/60);const view=engine.digest();for(const actor of view.actors)if(actor.attack?.action){const a=actor.attack.action;clips.add(a.clip);if(actor.kind==='hero'&&a.phase)phases.add(a.phase);assert.equal(actor.animation,a.clip);}hits+=engine.observe().events.filter(e=>e.type==='impact').length;}
 assert.equal(rules.catalogScope,'review-trial');assert.ok(hits>0);assert.ok(clips.has('Block_Attack'));assert.deepEqual([...phases].sort(),['ha','jo','kyu']);
 assert.ok(rules.sequence.every(r=>r.scope==='review-trial'));assert.throws(()=>createJohakyuCatalogRules({loadout:{jo:'fake.secret'}}),/Unregistered/);
});
