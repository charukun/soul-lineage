import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_DAY_SECONDS,isRaidNightHour,raidNightId,raidWindowForClock} from '../night-window.js';

test('one world day gives a five-minute 17:00-05:00 night',()=>{
  assert.equal(WORLD_DAY_SECONDS,600);
  assert.equal((12/24)*WORLD_DAY_SECONDS,300);
});
test('raid-night boundaries are explicit',()=>{
  assert.equal(isRaidNightHour(16+59/60),false);
  assert.equal(isRaidNightHour(17),true);
  assert.equal(isRaidNightHour(4+59/60),true);
  assert.equal(isRaidNightHour(5),false);
});
test('night id remains stable across midnight',()=>{
  const dusk=10+17/24,late=10+23.9/24,afterMidnight=11+4.9/24;
  assert.equal(raidNightId(dusk),raidNightId(late));
  assert.equal(raidNightId(late),raidNightId(afterMidnight));
  assert.equal(raidWindowForClock(afterMidnight).open,true);
});
