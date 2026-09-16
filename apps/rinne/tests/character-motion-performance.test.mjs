import test from 'node:test';
import assert from 'node:assert/strict';
import {THIRTY_SECOND_SLASH_BEATS,thirtySecondSlashBeat} from '../src/character-motion-performance.js';
import {SLASH_REVISION,sampleSlashPose} from '../public/simulator/src/authored-slash.js';

const distance=(a,b)=>Math.hypot(...a.map((value,index)=>value-b[index]));

test('30-second slash block builds toward the final cut without changing skill duration',()=>{
  assert.deepEqual(THIRTY_SECOND_SLASH_BEATS,[0,2.35,4.45]);
  assert.equal(thirtySecondSlashBeat(0,.66).index,0);
  assert.equal(thirtySecondSlashBeat(.659,.66).index,0);
  assert.equal(thirtySecondSlashBeat(.66,.66),null);
  assert.equal(thirtySecondSlashBeat(2.35,.66).index,1);
  assert.equal(thirtySecondSlashBeat(4.45,.66).index,2);
  assert.equal(thirtySecondSlashBeat(5.109,.66).index,2);
  assert.equal(thirtySecondSlashBeat(5.11,.66),null);
  assert.equal(6-THIRTY_SECOND_SLASH_BEATS.at(-1)-.66,.89,'slash block should retain a deliberate settle before sheathing');
  assert.ok(THIRTY_SECOND_SLASH_BEATS[1]-THIRTY_SECOND_SLASH_BEATS[0]>THIRTY_SECOND_SLASH_BEATS[2]-THIRTY_SECOND_SLASH_BEATS[1],'three cuts should compress toward the finish');
  assert.throws(()=>thirtySecondSlashBeat(NaN,.66));
  assert.throws(()=>thirtySecondSlashBeat(0,0));
});

test('slash v2 reads as anticipation, release, follow-through and braking at 1x',()=>{
  assert.equal(SLASH_REVISION,'shino-slash-2');
  const anticipation=sampleSlashPose(.34),contact=sampleSlashPose(.50),follow=sampleSlashPose(.70),brake=sampleSlashPose(.90);
  assert.ok(anticipation.offset[1]<-.16,'anticipation should visibly lower the centre of mass');
  assert.ok(Math.abs(anticipation.hips[1]-anticipation.chest[1])>.18,'pelvis and chest should counter-rotate during loading');
  assert.ok(contact.offset[2]>.16,'contact should carry the body forward instead of swinging only the arms');
  assert.ok(follow.shield[0]>.34,'free hand should stay active as a balance/guard hand through follow-through');
  const releaseTravel=distance(sampleSlashPose(.40).blade,contact.blade);
  const brakingTravel=distance(sampleSlashPose(.82).blade,brake.blade);
  assert.ok(releaseTravel>brakingTravel*2,'release must be clearly faster than late recovery');
  assert.ok(Math.abs(follow.head[1])<Math.abs(follow.hips[1])*.5,'head should keep attention closer to target while the hips finish rotating');
});
