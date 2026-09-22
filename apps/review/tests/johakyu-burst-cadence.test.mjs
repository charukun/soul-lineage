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
  assert.match(controller, /createJohakyuP7ReviewScenario\(\{mode,comboStyle:'burst'\}\)/);
});
