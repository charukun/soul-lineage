import test from 'node:test';
import assert from 'node:assert/strict';
import {THIRTY_SECOND_ENBU_REVISION,THIRTY_SECOND_SLASH_BEATS,thirtySecondSlashBeat,thirtySecondEnbuStructure} from '../src/character-motion-performance.js';
import {SLASH_REVISION,SLASH_VARIANTS,sampleSlashPose} from '../public/simulator/src/authored-slash.js';

const distance=(a,b)=>Math.hypot(...a.map((value,index)=>value-b[index]));

test('30-second slash block is a three-technique phrase with preparation and zanshin',()=>{
  assert.equal(THIRTY_SECOND_ENBU_REVISION,'three-cut-choreography-2');
  assert.deepEqual(THIRTY_SECOND_SLASH_BEATS.map(({start,variant})=>[start,variant]),[[.35,'cross'],[2.05,'return'],[3.85,'finisher']]);
  assert.deepEqual(THIRTY_SECOND_SLASH_BEATS.map(beat=>beat.variant),SLASH_VARIANTS);
  for(const [index,beat] of THIRTY_SECOND_SLASH_BEATS.entries()){
    assert.equal(thirtySecondSlashBeat(beat.start,.66).index,index);
    assert.equal(thirtySecondSlashBeat(beat.start,.66).variant,beat.variant);
    assert.equal(thirtySecondSlashBeat(beat.start+.659,.66).variant,beat.variant);
    assert.equal(thirtySecondSlashBeat(beat.start+.66,.66),null);
  }
  for(let i=1;i<THIRTY_SECOND_SLASH_BEATS.length;i++)assert.ok(THIRTY_SECOND_SLASH_BEATS[i].start>THIRTY_SECOND_SLASH_BEATS[i-1].start+.66,'beats must not overlap');
  const structure=thirtySecondEnbuStructure(.66);
  assert.equal(structure.preparation,.35);
  assert.ok(Math.abs(structure.zanshin-1.49)<1e-9,'finisher must leave a readable zanshin before sheathing');
  assert.throws(()=>thirtySecondSlashBeat(NaN,.66));
  assert.throws(()=>thirtySecondSlashBeat(0,0));
  assert.throws(()=>thirtySecondEnbuStructure(0));
});

test('slash v3 preserves the v2 force chain while adding materially different techniques',()=>{
  assert.equal(SLASH_REVISION,'shino-slash-3-combo');
  const anticipation=sampleSlashPose(.34),contact=sampleSlashPose(.50),follow=sampleSlashPose(.70),brake=sampleSlashPose(.90);
  assert.ok(anticipation.offset[1]<-.16,'anticipation should visibly lower the centre of mass');
  assert.ok(Math.abs(anticipation.hips[1]-anticipation.chest[1])>.18,'pelvis and chest should counter-rotate during loading');
  assert.ok(contact.offset[2]>.16,'contact should carry the body forward instead of swinging only the arms');
  assert.ok(follow.shield[0]>.34,'free hand should stay active as a balance/guard hand through follow-through');
  const releaseTravel=distance(sampleSlashPose(.40).blade,contact.blade),brakingTravel=distance(sampleSlashPose(.82).blade,brake.blade);
  assert.ok(releaseTravel>brakingTravel*2,'release must be clearly faster than late recovery');
  assert.ok(Math.abs(follow.head[1])<Math.abs(follow.hips[1])*.5,'head should keep attention closer to target while the hips finish rotating');

  const crossLoad=sampleSlashPose(.34,.5,'cross'),returnLoad=sampleSlashPose(.34,.5,'return'),finisherLoad=sampleSlashPose(.34,.5,'finisher');
  const crossHit=sampleSlashPose(.50,.5,'cross'),returnHit=sampleSlashPose(.50,.5,'return'),finisherHit=sampleSlashPose(.50,.5,'finisher');
  assert.ok(crossLoad.grip[0]<-.35&&returnLoad.grip[0]<crossLoad.grip[0]-.50,'return cut must counter-load outside the torso');
  assert.ok(crossHit.hips[1]>.25&&returnHit.hips[1]<-.25,'return cut must reverse the pelvis chain, not only the wrist');
  assert.ok(finisherLoad.grip[1]>.35,'finisher must raise the weapon into a distinct high preparation');
  assert.ok(finisherHit.offset[1]<crossHit.offset[1]-.03,'finisher must absorb contact with a deeper base');
});
