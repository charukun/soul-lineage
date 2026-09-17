import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReplayClass,
  approximationCounterexample,
  causalClosureCheck,
  classifyReplayability,
  entropyReplayCounterexample,
  exactReplayWitness,
  fixedPointKernel,
  framePartitionCounterexample,
  oracleCounterexample,
  replayWithRecordedEntropy,
  robustThreshold,
  unsafeApproximatePromotion
} from '../scripts/reality-reproducibility-model.mjs';

test('same wall time partition can advance capped simulation differently',()=>{
  const w=framePartitionCounterexample();
  assert.equal(w.sameWallTime,true);
  assert.equal(w.sameSimulation,false);
  assert.equal(w.coarse.x,.2);
  assert.equal(w.split.x,.4);
});

test('input-only replay is incomplete when entropy is hidden',()=>{
  const w=entropyReplayCounterexample();
  assert.equal(w.sameInput,true);
  assert.equal(w.sameOutcome,false);
});

test('recorded entropy closes the toy replay',()=>{
  const state={score:0}, input={power:5,criticalChance:.2};
  assert.deepEqual(replayWithRecordedEntropy(state,input,17),replayWithRecordedEntropy(state,input,17));
});

test('implementation approximation latitude can be amplified by threshold',()=>{
  assert.equal(approximationCounterexample().diverges,true);
});

test('robust threshold certifies outcomes with margin',()=>{
  assert.equal(robustThreshold({estimate:10,errorBound:.5,threshold:8}).verdict,'TRUE');
  assert.equal(robustThreshold({estimate:5,errorBound:.5,threshold:8}).verdict,'FALSE');
});

test('robust threshold escalates a boundary case',()=>{
  assert.equal(robustThreshold({estimate:8,errorBound:.5,threshold:8}).verdict,'UNCERTAIN');
});

test('point-estimate mutation misclassifies uncertain case',()=>{
  const safe=robustThreshold({estimate:8,errorBound:.5,threshold:8});
  const mutant=unsafeApproximatePromotion({estimate:8,errorBound:.5,threshold:8});
  assert.equal(safe.verdict,'UNCERTAIN');
  assert.equal(mutant,'TRUE');
});

test('integer event kernel replays bit-identically',()=>{
  assert.equal(exactReplayWitness().identical,true);
});

test('integer kernel is sensitive to event order/content',()=>{
  const initial={hp:100,xMm:0,stamina:100,tick:0};
  const a=fixedPointKernel(initial,[{tick:1,type:'damage',amount:30},{tick:2,type:'damage',amount:20}]);
  const b=fixedPointKernel(initial,[{tick:1,type:'damage',amount:20},{tick:2,type:'damage',amount:30}]);
  assert.notEqual(a.root,b.root);
  assert.deepEqual(a.state,b.state);
});

test('current external response cannot replay a historical decision',()=>{
  const w=oracleCounterexample();
  assert.equal(w.stable,false);
  assert.equal(w.fromRecorded.outcome,'ALLOW');
  assert.equal(w.fromCurrent.outcome,'DENY');
});

test('causal closure rejects missing nondeterministic inputs',()=>{
  assert.deepEqual(causalClosureCheck({required:['command','dt-sequence','entropy','rule-root'],recorded:['command','rule-root']}).missing,['dt-sequence','entropy']);
});

test('replay classes are distinct contracts',()=>{
  assert.equal(classifyReplayability({deterministicKernel:true}),ReplayClass.EXACT);
  assert.equal(classifyReplayability({errorBound:.1,decisionMargin:.5}),ReplayClass.ROBUST);
  assert.equal(classifyReplayability({externalAuthority:true}),ReplayClass.AUTHORITY);
  assert.equal(classifyReplayability({}),ReplayClass.UNCLASSIFIED);
});
