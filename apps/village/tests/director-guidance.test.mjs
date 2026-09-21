import test from 'node:test';
import assert from 'node:assert/strict';
import {nextVillageGoal,nextVillageGuidance} from '../src/game/director-guidance.js';

function fixture({tutorial=null,raid=null,proposal=null,population={},people=[],objects=[],known=[]}={}) {
  return {
    tutorialStep:()=>tutorial,
    state:{defense:{raid,proposal},known},
    population:()=>({people:2,openBeds:4,safety:6,food:6,...population}),
    people,
    objects,
  };
}

test('authored tutorial remains the first source of direction',()=>{
  const world=fixture({tutorial:{kind:'tent'}});
  assert.equal(nextVillageGuidance(world),null);
  assert.equal(nextVillageGoal(world),null);
});

test('immediate threat takes priority over growth advice',()=>{
  const next=nextVillageGuidance(fixture({raid:{phase:'warning'},population:{openBeds:2,safety:1,food:1},known:['wood']}));
  assert.equal(next.id,'raid-warning');
  assert.match(next.title,/騒がしい/);
  assert.equal(next.action.kind,'guardpost');
});

test('housing, safety and food bottlenecks point into the matching build flow',()=>{
  const housing=nextVillageGuidance(fixture({population:{people:4,openBeds:4,safety:8,food:8}}));
  assert.equal(housing.id,'housing');
  assert.equal(housing.action.kind,'tent');

  const safety=nextVillageGuidance(fixture({population:{people:4,openBeds:6,safety:4,food:8},known:['wood']}));
  assert.equal(safety.id,'safety');
  assert.equal(safety.action.kind,'guardpost');

  const food=nextVillageGuidance(fixture({population:{people:4,openBeds:6,safety:8,food:4}}));
  assert.equal(food.id,'food-source');
  assert.equal(food.action.kind,'wheat');
});

test('idle resident turns into an actionable village voice after the authored tutorial',()=>{
  const resident={name:'ミナ',role:'resident',dead:false,jobId:null};
  const next=nextVillageGuidance(fixture({
    people:[resident],
    objects:[{kind:'wheat'},{kind:'storage'},{kind:'quarry'}],
  }));
  assert.equal(next.id,'work');
  assert.match(next.title,/ミナ.*仕事/);
  assert.equal(next.action.kind,'logging');
  assert.equal(next.action.label,'仕事場をつくる');
  assert.match(nextVillageGoal(fixture({people:[resident],objects:[{kind:'wheat'}]})),/仕事/);
});

test('work suggestion reacts to what the village already has instead of repeating one facility forever',()=>{
  const resident={name:'ミナ',role:'resident',dead:false,jobId:null};
  const next=nextVillageGuidance(fixture({
    people:[resident],
    objects:[{kind:'wheat'},{kind:'logging'},{kind:'logging'}],
  }));
  assert.equal(next.action.kind,'storage');
});

test('stable villages keep a quiet contextual hint without forcing another construction',()=>{
  const resident={name:'ミナ',role:'resident',dead:false,jobId:'b-work'};
  const next=nextVillageGuidance(fixture({people:[resident],objects:[{kind:'wheat'}]}));
  assert.equal(next.id,'stable');
  assert.equal(next.action,null);
  assert.match(nextVillageGoal(fixture({people:[resident],objects:[{kind:'wheat'}]})),/穏やか/);
});


test('repeated danger becomes a guard proposal without placing a permanent structure',()=>{
  const proposal={sector:'east',side:'東側',x:25,z:8,kind:'fence',score:2,day:10,source:'raid',guardName:'アルド'};
  const next=nextVillageGuidance(fixture({
    proposal,
    known:['wood'],
    population:{people:4,openBeds:6,safety:8,food:8},
    people:[{name:'ミナ',role:'resident',dead:false,jobId:'b-work'}],
    objects:[{kind:'wheat'}],
  }));
  assert.equal(next.id,'defense-proposal');
  assert.equal(next.action.kind,'fence');
  assert.deepEqual(next.action.at,[25,8]);
  assert.match(next.title,/アルド.*東側/);
  assert.match(next.text,/勝手に建てず/);
});
