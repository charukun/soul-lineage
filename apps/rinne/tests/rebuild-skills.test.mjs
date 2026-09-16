import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,tickLife} from '../src/rebuild/domain.js';
import {SUPPORT_SKILLS,ACTION_SKILLS,eligibleDiscoveries,skillEffects} from '../src/rebuild/skill-system.js';

function living(seed=1){const state=createLife({seed});state.phase='living';state.ageYears=10;state.ageSeconds=600;state.resting=false;return state;}
function completeActivity(state,station){for(let i=0;i<33;i++)tickLife(state,{realDelta:.25,station});}

test('non-attack inspirations substantially outnumber action inspirations',()=>{
  assert.ok(SUPPORT_SKILLS.length>=28);
  assert.ok(SUPPORT_SKILLS.length>ACTION_SKILLS.length);
  assert.ok(ACTION_SKILLS.length>=12);
});

test('one housing trait cycle can spark an easy related support skill',()=>{
  const state=living(11),station={id:'room.bed',label:'ベッド',activity:'breathe',actionLabel:'寝床で呼吸を整える'};
  completeActivity(state,station);
  assert.ok(state.knownSkills.includes('skill.breath'));
  assert.ok(state.experiences.breathe.score>=.65);
});

test('dummy practice first sparks support skills that accelerate later action inspiration',()=>{
  const state=living(12),dummy={id:'training-dummy',label:'かかし',activity:'practice',actionLabel:'かかしで型を反復する'};
  completeActivity(state,dummy);
  assert.ok(state.knownSkills.includes('skill.repeat'));
  assert.ok(state.knownSkills.includes('skill.distance'));
  const effects=skillEffects(state);assert.ok(effects.trainingGain>0);assert.ok(effects.actionSpark>0);
});

test('action-spark support lowers the practice threshold without rewriting base thresholds',()=>{
  const plain=living(13),boosted=living(14);
  plain.knownSkills.push('skill.balance');boosted.knownSkills.push('skill.balance','skill.observe');
  plain.experiences.practice={count:2,score:1.3,last:0};boosted.experiences.practice={count:2,score:1.3,last:0};
  assert.equal(eligibleDiscoveries(plain).some(row=>row.id==='action.guard-step'),false);
  assert.equal(eligibleDiscoveries(boosted).some(row=>row.id==='action.guard-step'),true);
});

test('learned support and action skills materially alter survival, reach and damage totals',()=>{
  const state=living(15);state.knownSkills.push('skill.balance','skill.adapt','skill.focus','skill.distance','action.lunge');
  const effects=skillEffects(state);
  assert.ok(effects.mitigation>=.09);assert.ok(effects.damage>=.12);assert.ok(effects.reach>=.2);assert.ok(effects.actionSpark>0);
});
