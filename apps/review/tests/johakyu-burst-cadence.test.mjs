import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BURST_CADENCE, burstCompositionFor, burstSettleSeconds, burstStageDuration} from '../src/nocturne/johakyu-burst-cadence.js';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';

const phases = ['jo', 'ha', 'kyu'];
test('burst is three attacking stages in each phase, not three multi-technique chains', () => {
  const composition = burstCompositionFor('sword');
  for (const phase of phases) {
    assert.equal(composition[phase].length, 1);
    const technique = composition[phase][0];
    assert.equal(technique.stages.length, 3);
    for (const stage of technique.stages) {
      assert.ok(['slash', 'thrust', 'back'].includes(stage.kind));
      assert.equal(stage.step.charge, 'none');
      assert.equal(stage.phase, phase);
      assert.ok(burstStageDuration(technique, stage) >= .18);
      assert.ok(burstStageDuration(technique, stage) <= .26);
    }
  }
  assert.equal(phases.flatMap(phase => composition[phase][0].stages).length, 9);
  assert.ok(Object.isFrozen(composition));
});

test('intra-phase links and phase links are tiny; only the final link has long recovery', () => {
  assert.equal(burstSettleSeconds('jo', 'jo'), .02);
  assert.equal(burstSettleSeconds('jo', 'ha'), .06);
  assert.equal(burstSettleSeconds('ha', 'kyu'), .06);
  assert.equal(burstSettleSeconds('kyu', 'jo'), .85);
  assert.ok(BURST_CADENCE.recovery > BURST_CADENCE.phaseGap * 10);
});

test('battle2 uses the burst executor option for both sides without removing composition fixtures', () => {
  const burst = createJohakyuP7ReviewScenario({comboStyle: 'burst'});
  for (const side of ['hero', 'enemy']) for (const phase of phases) {
    assert.equal(burst.composition[side][phase].length, 1);
    assert.equal(burst.composition[side][phase][0].stages.length, 3);
  }
  assert.equal(burst.inspect().meta.comboStyle, 'burst');
  assert.equal(createJohakyuP7ReviewScenario().composition.hero.jo.length, 2);
  assert.throws(() => createJohakyuP7ReviewScenario({comboStyle: 'burst', heroStartTechniqueIndex: 1}), RangeError);
  assert.throws(() => createJohakyuP7ReviewScenario({comboStyle: 'unknown'}), RangeError);
  const controller = readFileSync(new URL('../src/nocturne/johakyu-p7-controller.js', import.meta.url), 'utf8');
  assert.match(controller, /createJohakyuP7ReviewScenario\(\{mode,comboStyle:'burst',duelGap:mode==='duel'\?2\.18:3\.15,enemyLeadSeconds:mode==='duel'\?\.16:0\}\)/);
});


test('battle2 duel burst actually opens combat instead of remaining in the ready/read loop', () => {
  const scenario=createJohakyuP7ReviewScenario({mode:'duel',comboStyle:'burst',duelGap:2.18,enemyLeadSeconds:.16});
  let stageStart=null,contact=null;
  for(let i=0;i<240&&!(stageStart&&contact);i++){
    const result=scenario.step(1/60);
    stageStart=stageStart||result.meta.activity.find(row=>row.type==='stage-start');
    contact=contact||result.events.find(row=>['player-hit','enemy-hit','guard','parry','clash'].includes(row.type));
  }
  assert.ok(stageStart,'1v1 burst must begin an authored attack within four seconds');
  assert.ok(contact,'1v1 burst must reach a real contact/defense event within four seconds');
});


test('battle2 burst uses a review-only low stamina multiplier so a full 序破急 pressure run is affordable', () => {
  const scenario=createJohakyuP7ReviewScenario({mode:'duel',comboStyle:'burst',duelGap:2.18,enemyLeadSeconds:.16});
  let reachedKyu=false,minHeroStamina=100;
  for(let i=0;i<720&&!reachedKyu;i++){
    const result=scenario.step(1/60),hero=result.frame.actors.find(actor=>actor.self);
    minHeroStamina=Math.min(minHeroStamina,hero.stamina.value);
    reachedKyu=reachedKyu||result.meta.activity.some(row=>row.type==='stage-start'&&row.actorId==='hero'&&row.phase==='kyu');
  }
  assert.equal(reachedKyu,true,'hero should be able to afford reaching 急 without stamina starvation');
  assert.ok(minHeroStamina>50,`battle2 review should remain stamina-rich, got ${minHeroStamina}`);
  const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
  assert.match(source,/BATTLE2_STAMINA_COST_MULTIPLIER=\.12/);
});
