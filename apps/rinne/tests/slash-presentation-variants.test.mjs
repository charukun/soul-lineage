import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SLASH_SECONDS,SLASH_TIMING,SLASH_VARIANTS,SWORD_FREE_GUARD,sampleSlashPose} from '../public/simulator/src/authored-slash.js';
import {slashPresentationVariant} from '../public/simulator/src/humanoid-finalized.js';

const distance=(a,b)=>Math.hypot(...a.map((value,index)=>value-b[index]));

test('all slash presentation variants share one gameplay clock and one guard seam',()=>{
  assert.equal(SLASH_SECONDS,.66);
  assert.deepEqual(SLASH_TIMING,{active:[.35,.64],contact:.5,launch:.34,plant:.49,chain:.86,lead:1});
  const start=sampleSlashPose(0,.5,'cross'),end=sampleSlashPose(1,.5,'cross');
  for(const variant of SLASH_VARIANTS){
    const a=sampleSlashPose(0,.5,variant),b=sampleSlashPose(1,.5,variant);
    assert.deepEqual(a,start,`${variant} must enter from the shared sword guard`);
    assert.deepEqual(b,end,`${variant} must return to the shared sword guard`);
    assert.deepEqual(a.grip,[-.19,-.37,.35]);
    assert.deepEqual(a.shield,[...SWORD_FREE_GUARD]);
    for(let i=0;i<=240;i++)for(const values of Object.values(sampleSlashPose(i/240,.5,variant)))assert.ok(values.every(Number.isFinite),`${variant} emitted a non-finite pose`);
  }
});

test('cross, return and finisher are different full-body trajectories rather than timing aliases',()=>{
  const load=Object.fromEntries(SLASH_VARIANTS.map(id=>[id,sampleSlashPose(.34,.5,id)]));
  const hit=Object.fromEntries(SLASH_VARIANTS.map(id=>[id,sampleSlashPose(.50,.5,id)]));
  assert.ok(distance(load.cross.grip,load.return.grip)>.5,'return needs a different weapon-side loading path');
  assert.ok(Math.abs(hit.cross.hips[1]-hit.return.hips[1])>.55,'return needs an opposite pelvis chain');
  assert.ok(load.finisher.grip[1]-load.cross.grip[1]>.45,'finisher needs a high preparation, not another diagonal cut');
  assert.ok(hit.cross.offset[1]-hit.finisher.offset[1]>.03,'finisher needs a deeper contact base');
});

test('runtime variant selection is deterministic and gameplay-authority neutral',async()=>{
  assert.equal(slashPresentationVariant({attack:{kind:'slash',id:'plain'}}),'cross');
  assert.equal(slashPresentationVariant({attack:{kind:'slash',comboIndex:null}}),'cross');
  assert.equal(slashPresentationVariant({attack:{kind:'slash',comboIndex:''}}),'cross');
  assert.equal(slashPresentationVariant({attack:{kind:'slash',presentationVariant:'return'}}),'return');
  assert.equal(slashPresentationVariant({attack:{kind:'slash',comboIndex:2}}),'finisher');
  assert.equal(slashPresentationVariant({attack:{kind:'slash',comboStep:4}}),'return');
  assert.equal(slashPresentationVariant({attack:{kind:'thrust',comboIndex:2}}),null);
  const source=await readFile(new URL('../public/simulator/src/humanoid-finalized.js',import.meta.url),'utf8');
  assert.match(source,/prepareSlashVariants/);
  assert.match(source,/!c\.slashPresentationVariants/,'same loaded Shino must not rebake all presentation clips');
  assert.match(source,/sword:slash:\$\{variant\}/);
  assert.match(source,/slashPresentationVariant/);
  assert.match(source,/contactTimingAuthority:'gameplay-external'/);
  assert.doesNotMatch(source,/a\.(?:x|z|yaw|attack)\s*=/);
});
