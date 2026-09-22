import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulation} from './helpers/johakyu-simulation.mjs';
import {createJohakyuReviewRules} from '../src/nocturne/johakyu-rules.js';
import {JOHAKYU_CLIPS} from '@soul/johakyu-combat';
const source=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../src/nocturne/manifest.json',import.meta.url),'utf8'));

function run(mind,seconds=60){
  const rules=createJohakyuReviewRules({mind}),engine=simulation(source,{rules});engine.init();
  const phases=new Set(),clips=new Set(),intents=new Set(),hits=[],seen=new Set(),actions=[];
  let last;
  for(let i=0;i<seconds*60;i++){
    engine.step(1/60);last=engine.digest();const observation=engine.observe();
    assert.equal(observation.authority,'johakyu-review');assert.equal(observation.readOnly,true);
    for(const a of last.actors){if(a.attack?.action){const action=a.attack.action;
      assert.equal(a.animation,action.clip);clips.add(action.clip);
      if(a.kind==='hero'){phases.add(action.phase);if(!seen.has(action.id)){seen.add(action.id);actions.push(action);}}}}
    for(const e of observation.events){hits.push(e);assert.ok(observation.actors.some(a=>a.id===e.targetId));}
    // The rule port contains only current actor data, never renderer objects.
    for(const e of last.trace)if(e.type==='johakyu-action')assert.ok(e.attackId&&e.motion);
    for(const actor of observation.actors){assert.ok(actor.hp>=0&&actor.hp<=actor.maxHp);}
  }
  return {phases,clips,hits,actions,last,audio:engine.audio,rules,engine};
}

test('phase execution reaches jo/ha/kyu with actual existing Knight and Skeleton clips',()=>{
  const result=run('balanced');
  for(const phase of ['jo','ha','kyu'])assert.ok(result.phases.has(phase),phase);
  assert.ok(result.hits.length>5);assert.ok(result.last.allKills>0);assert.ok(result.last.rounds>1);
  for(const id of ['adventurers/Knight','skeletons/Skeleton_Warrior']){
    const clips=new Set(manifest.models[id].animations);
    for(const binding of Object.values(JOHAKYU_CLIPS))assert.ok(clips.has(binding.clip),id+'/'+binding.clip);
  }
  assert.equal(result.last.game.bursts,0);assert.ok(result.last.game.wave<=1);
});

test('attention changes real combat outcomes; defensive reactions are not fake sequence steps',()=>{
  const aggressive=run('aggressive'),patient=run('patient'),counter=run('counter'),evasive=run('evasive');
  assert.ok(patient.actions.some(a=>a.reaction));assert.ok(counter.actions.some(a=>a.reaction));
  assert.ok(patient.actions.filter(a=>a.reaction).every(a=>a.phase===null&&a.techniqueId===null));
  const trajectory=result=>result.last.actors.map(a=>({hp:a.hp,position:a.position,combo:a.combo}));
  assert.notDeepEqual(trajectory(aggressive),trajectory(patient));
  assert.notDeepEqual(trajectory(aggressive),trajectory(evasive));
  assert.ok(patient.last.game.received!==aggressive.last.game.received||patient.last.allKills!==aggressive.last.allKills);
});

test('one physical impact is emitted once for its real source, target and attack instance',()=>{
  const result=run('balanced',20),ids=new Set(),contacts=new Set();
  for(const hit of result.hits){
    assert.ok(!ids.has(hit.id));ids.add(hit.id);assert.ok(hit.damage>0);assert.notEqual(hit.sourceId,hit.targetId);
    const key=hit.sourceId+'/'+hit.targetId+'/'+hit.attackId;
    assert.ok(!contacts.has(key),key);contacts.add(key);
  }
  assert.ok(ids.size>0);assert.ok(result.rules.snapshot().actors<=2);
});

test('accepted source and review-only ownership are explicit without touching saves',()=>{
  const rules=readFileSync(new URL('../src/nocturne/johakyu-rules.js',import.meta.url),'utf8');
  assert.doesNotMatch(rules,/localStorage|sessionStorage|Math\.random|Date\.now|save\(/);
  const stage=readFileSync(new URL('../src/nocturne-stage.js',import.meta.url),'utf8');
  assert.match(stage,/parameters\.get\('johakyu'\)==='p2'/);
});
