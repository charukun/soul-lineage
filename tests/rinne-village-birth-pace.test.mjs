import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BIRTH_TOUR_PACE} from '../apps/rinne/src/rebuild/birth-tour.js';

const villageSimulation=await readFile(new URL('../apps/village/src/game/simulation.js',import.meta.url),'utf8');

function villageWalkPace(source){
  const match=source.match(/let left=dt\*\(isGuard\(p\)\?([0-9.]+):([0-9.]+)\)/);
  assert.ok(match,'Village resident/guard world-space walk pace must remain discoverable for cross-app balance');
  return{guard:Number(match[1]),resident:Number(match[2])};
}

test('Rinne passive birth tour stays inside Village life-scale movement pace',()=>{
  const village=villageWalkPace(villageSimulation);
  assert.equal(village.resident,2.8);
  assert.equal(village.guard,4.6);
  assert.ok(BIRTH_TOUR_PACE.autoMin>village.resident);
  assert.equal(BIRTH_TOUR_PACE.autoMax,village.guard);
  assert.ok(BIRTH_TOUR_PACE.manualMin>BIRTH_TOUR_PACE.autoMin);
  assert.ok(BIRTH_TOUR_PACE.manualMax<=village.guard*1.15);
});
