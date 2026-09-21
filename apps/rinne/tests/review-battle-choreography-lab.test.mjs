import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTION_LIBRARY_SOURCE_BY_ID} from '../src/review-motion-sources.js';
import {REVIEW_AUTHORED_EFFECTS} from '../src/rebuild/authored-effect-manifest.js';
import {INSPIRATION_MOTION_SELECTIONS,INSPIRATION_MOTION_CLIPS,INSPIRATION_VFX_SELECTIONS,inspirationAttackClipName,blendInspirationPose} from '../src/review-battle-choreography-lab.js';

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
  assert.equal(inspirationAttackClipName('sword',[{kind:'thrust'}]),'Melee_1H_Attack_Stab');
  assert.equal(inspirationAttackClipName('sword',[{kind:'slash'}]),'Melee_1H_Attack_Slice_Horizontal');
  assert.equal(inspirationAttackClipName('great',[{kind:'heavy'}]),'Melee_2H_Attack_Slice');
  assert.equal(inspirationAttackClipName('spear',[{kind:'pierce'}]),'Melee_2H_Attack_Stab');
  assert.equal(inspirationAttackClipName('fist',[{kind:'straight'}]),'Melee_Unarmed_Attack_Punch_A');
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
