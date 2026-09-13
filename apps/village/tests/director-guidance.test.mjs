import test from 'node:test';
import assert from 'node:assert/strict';
import {nextVillageGoal} from '../src/game/director-guidance.js';

function fixture({tutorial=null,raid=null,population={},people=[]}={}) {
  return {
    tutorialStep:()=>tutorial,
    state:{defense:{raid}},
    population:()=>({people:2,openBeds:4,safety:6,food:6,...population}),
    people,
  };
}

test('authored tutorial remains the first source of direction',()=>{
  assert.equal(nextVillageGoal(fixture({tutorial:{kind:'tent'}})),null);
});

test('immediate threat takes priority over growth advice',()=>{
  assert.match(nextVillageGoal(fixture({raid:{phase:'warning'},population:{openBeds:2,safety:1,food:1}})),/襲来/);
});

test('housing, safety and food bottlenecks are surfaced in systemic order',()=>{
  assert.match(nextVillageGoal(fixture({population:{people:4,openBeds:4,safety:8,food:8}})),/寝床/);
  assert.match(nextVillageGoal(fixture({population:{people:4,openBeds:6,safety:4,food:8}})),/警備/);
  assert.match(nextVillageGoal(fixture({population:{people:4,openBeds:6,safety:8,food:4}})),/食事/);
});

test('idle resident is suggested before cosmetic sandboxing',()=>{
  const resident={name:'ミナ',role:'resident',dead:false,jobId:null};
  assert.match(nextVillageGoal(fixture({people:[resident]})),/ミナ/);
  resident.jobId='b-work';
  assert.match(nextVillageGoal(fixture({people:[resident]})),/暮らしは安定/);
});
