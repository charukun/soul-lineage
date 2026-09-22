import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_LIBRARY_SOURCE_BY_ID} from '../src/review/motion/sources.js';
import {REVIEW_AUTHORED_EFFECTS} from '../src/rebuild/authored-effect-manifest.js';
import {INSPIRATION_MOTION_SELECTIONS,INSPIRATION_MOTION_CLIPS,INSPIRATION_VFX_SELECTIONS,inspirationAttackClipName,inspirationMotionPlan,blendInspirationPose} from '../src/review/battle/choreography-lab.js';

test('inspiration choreography is sourced from pinned Visual Review motion assets',()=>{
  for(const row of Object.values(INSPIRATION_MOTION_CLIPS)){
    const source=MOTION_LIBRARY_SOURCE_BY_ID[row.sourceId];
    assert.ok(source?.selfHosted, row.sourceId+' must be self-hosted');
    assert.equal(source.license,'CC0-1.0');
    assert.equal(source.clips[row.index]?.name,row.name);
    assert.match(source.gitBlobSha,/^[a-f0-9]{40}$/);
  }
  assert.equal(INSPIRATION_MOTION_SELECTIONS.evade.left,'Dodge_Left');
  assert.equal(INSPIRATION_MOTION_SELECTIONS.evade.right,'Dodge_Right');
  assert.ok(['Melee_1H_Attack_Stab','Melee_Block_Attack','Melee_1H_Attack_Jump_Chop'].includes(inspirationAttackClipName('sword',[{kind:'thrust'}],'thrust-a')));
  assert.ok(['Melee_1H_Attack_Slice_Diagonal','Melee_1H_Attack_Slice_Horizontal','Melee_1H_Attack_Chop'].includes(inspirationAttackClipName('sword',[{kind:'slash'}],'slash-a')));
  assert.ok(['Melee_2H_Attack_Chop','Melee_2H_Attack_Spinning','Melee_2H_Attack_Slice'].includes(inspirationAttackClipName('great',[{kind:'heavy'}],'heavy-a')));
  assert.ok(['Melee_2H_Attack_Stab','Melee_2H_Attack_Slice'].includes(inspirationAttackClipName('spear',[{kind:'pierce'}],'pierce-a')));
  assert.ok(['Melee_Unarmed_Attack_Punch_A','Melee_Unarmed_Attack_Kick'].includes(inspirationAttackClipName('fist',[{kind:'straight'}],'fist-a')));
});

test('inspiration VFX uses authored lab assets instead of generated rings',()=>{
  for(const id of Object.values(INSPIRATION_VFX_SELECTIONS))assert.ok(REVIEW_AUTHORED_EFFECTS[id],id+' must exist in the authored VFX manifest');
  assert.equal(INSPIRATION_VFX_SELECTIONS.trail,'slash');
  assert.equal(INSPIRATION_VFX_SELECTIONS.impact,'impact');
  assert.equal(INSPIRATION_VFX_SELECTIONS.debris,'lib-effectmaterials-parts-hit01');
  assert.ok(!Object.values(INSPIRATION_VFX_SELECTIONS).some(id=>/ring|circle|magic-circle/i.test(id)));
});

test('motion crossfade keeps canonical humanoid pose data finite',()=>{
  const a={space:'humanoid-preview-v1',rotations:{hips:[0,0,0,1],head:[0,0,0,1]},hips:[0,0,0],profile:{height:2},bindingStatus:'PLAYABLE'};
  const b={...a,rotations:{hips:[0,.3826834,0,.9238795],head:[.258819,0,0,.9659258]},hips:[.1,.2,.3]};
  const mixed=blendInspirationPose(a,b,.5);
  assert.equal(mixed.space,'humanoid-preview-v1');
  assert.ok(mixed.hips.every(Number.isFinite));
  for(const q of Object.values(mixed.rotations))assert.ok(q.every(Number.isFinite));
});


test('different inspiration techniques compile to distinct deterministic choreography signatures',()=>{
  const sharedSteps=[{kind:'slash',footwork:'stay'},{kind:'thrust',footwork:'forward'}];
  const a=inspirationMotionPlan({techniqueId:'review.sword.ha.moon-thread',phase:'ha',weapon:'sword',steps:sharedSteps});
  const a2=inspirationMotionPlan({techniqueId:'review.sword.ha.moon-thread',phase:'ha',weapon:'sword',steps:sharedSteps});
  const b=inspirationMotionPlan({techniqueId:'review.sword.ha.returning-tide',phase:'ha',weapon:'sword',steps:sharedSteps});
  assert.equal(a.signature,a2.signature);
  assert.notEqual(a.signature,b.signature);
  assert.equal(a.segments.length,2);
  assert.notEqual(a.seed,b.seed);
});

test('all authored steps participate in the inspiration motion instead of collapsing to the first attack',()=>{
  const plan=inspirationMotionPlan({techniqueId:'review.sword.kyu.three-beat',phase:'kyu',weapon:'sword',steps:[
    {kind:'slash',footwork:'forward'},{kind:'crosscut',footwork:'stay'},{kind:'thrust',footwork:'forward'}
  ]});
  assert.equal(plan.segments.length,3);
  assert.deepEqual(plan.segments.map(row=>row.kind),['slash','crosscut','thrust']);
  assert.match(plan.signature,/slash:/);
  assert.match(plan.signature,/crosscut:/);
  assert.match(plan.signature,/thrust:/);
});
