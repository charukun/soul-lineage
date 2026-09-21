import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulation} from './helpers/johakyu-simulation.mjs';
const root=new URL('../../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const current=read('packages/johakyu-presentation/src/runtime.js');
const original=read('apps/review/src/nocturne-bk/runtime.js');

test('disabled and frequently read bridges preserve 120 seconds of actual combat and RNG',()=>{
  const baseline=simulation(original),disabled=simulation(current),observed=simulation(current);
  for(const engine of [baseline,disabled,observed])engine.init();
  const stable=new Map();let reads=0;
  for(let tick=0;tick<7200;tick++){
    for(const engine of [baseline,disabled,observed])engine.step(1/60);
    if(tick%13===0){
      const before=observed.digest(),a=observed.observe(),b=observed.observe();
      assert.deepEqual(a,b);assert.deepEqual(observed.digest(),before);reads++;
      for(const row of a.actors){const known=stable.get(row.id);if(known)assert.equal(row.side,known);else stable.set(row.id,row.side);}
      assert.equal(a.authority,'native-demo');assert.deepEqual(a.events,[]);
      assert.ok(a.actors.every(row=>row.phase===null));
    }
    if(tick%60===0){assert.deepEqual(disabled.digest(),baseline.digest());assert.deepEqual(observed.digest(),baseline.digest());}
  }
  assert.ok(reads>500);assert.ok(baseline.digest().allKills>0);assert.ok(baseline.audio.length>0);
  assert.deepEqual(observed.audio,baseline.audio);assert.deepEqual(disabled.audio,baseline.audio);
  assert.deepEqual(observed.digest(),baseline.digest());
});

test('snapshot is detached, uses existing actor UUIDs, and resets battle identity with boot epoch',()=>{
  const engine=simulation(current);assert.equal(engine.observe(),null);engine.init();
  const a=engine.observe(1);assert.match(a.actors[0].id,/^[0-9a-f-]{36}$/i);
  assert.notEqual(engine.observe(2).battleId,a.battleId);
  assert.throws(()=>{a.actors[0].hp=0;},TypeError);assert.equal(engine.observe().actors[0].hp,220);
  const id=a.actors[0].id;engine.step(1/60);assert.equal(engine.observe().actors[0].id,id);
  engine.unavailable();assert.equal(engine.observe(),null);
});

test('stage exposes only a lazy read and does not schedule observation work',()=>{
  const stage=read('apps/review/src/nocturne-stage.js');
  assert.match(stage,/get observation\(\)\{return prepared\?runtime\?\.inspectBattle\(sequence\)\?\?null:null;\}/);
  assert.equal((stage.match(/inspectBattle/g)||[]).length,1);
  assert.doesNotMatch(read('packages/shared-ui/src/johakyu-observation.js'),/Math\.random|localStorage|Date\.now|setInterval|requestAnimationFrame|\.advance\(/);
});
