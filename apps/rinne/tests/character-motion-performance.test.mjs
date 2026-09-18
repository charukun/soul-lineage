import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THIRTY_SECOND_ENBU_SEGMENTS,THIRTY_SECOND_SLASH_BEATS,thirtySecondEnbuState,thirtySecondSlashBeat} from '../src/character-motion-performance.js';
import {SLASH_REVISION,sampleSlashPose} from '../public/simulator/src/authored-slash.js';

const distance=(a,b)=>Math.hypot(...a.map((value,index)=>value-b[index]));

test('30-second enbu keeps Shino moving through the full six-second combat phrase',()=>{
  assert.deepEqual(THIRTY_SECOND_SLASH_BEATS,[.28,1.48,2.40,3.32,4.30]);
  assert.equal(THIRTY_SECOND_ENBU_SEGMENTS[0].start,0);
  assert.equal(THIRTY_SECOND_ENBU_SEGMENTS.at(-1).end,6);
  for(let i=0;i<THIRTY_SECOND_ENBU_SEGMENTS.length-1;i++)assert.ok(Math.abs(THIRTY_SECOND_ENBU_SEGMENTS[i].end-THIRTY_SECOND_ENBU_SEGMENTS[i+1].start)<1e-9,'enbu must not fall back to a dead guard gap');
  for(let frame=0;frame<6*120;frame++)assert.ok(thirtySecondEnbuState(frame/120,.66),`uncovered frame ${frame}`);
  const cuts=THIRTY_SECOND_ENBU_SEGMENTS.filter(row=>row.mode==='slash'),moves=THIRTY_SECOND_ENBU_SEGMENTS.filter(row=>row.mode==='move');
  assert.equal(cuts.length,5,'the phrase should carry five full dynamic cuts instead of three isolated samples');
  assert.ok(moves.some(row=>Math.hypot(row.vx,row.vz)>2.4),'the phrase needs a real run-speed surge between cuts');
  assert.ok(moves.some(row=>row.vx<0)&&moves.some(row=>row.vx>0),'footwork must cut across both sides instead of rocking in place');
  assert.equal(THIRTY_SECOND_ENBU_SEGMENTS.find(row=>row.mode==='parry').id,'receive');
  assert.ok(Math.abs(THIRTY_SECOND_ENBU_SEGMENTS.at(-1).end-THIRTY_SECOND_ENBU_SEGMENTS.at(-1).start-.76)<1e-9,'final zanshin should settle without consuming the action phrase');
  for(const [index,start] of THIRTY_SECOND_SLASH_BEATS.entries()){
    assert.equal(thirtySecondSlashBeat(start,.66).index,index);
    assert.equal(thirtySecondSlashBeat(start+.659,.66).index,index);
  }
  assert.equal(thirtySecondEnbuState(6,.66),null);
  assert.throws(()=>thirtySecondEnbuState(NaN,.66));
  assert.throws(()=>thirtySecondEnbuState(0,0));
  assert.throws(()=>thirtySecondEnbuState(.28,.5),/no longer matches/);
});

test('30-second source reuses the original dynamic slash instead of replacing it with presentation variants',async()=>{
  assert.equal(SLASH_REVISION,'shino-slash-2');
  const source=await readFile(new URL('../src/character-motion-source.js',import.meta.url),'utf8');
  assert.match(source,/thirtySecondEnbuState/);
  assert.match(source,/parryMotion/);
  assert.match(source,/zanshin/);
  assert.match(source,/actor\.vx=enbu\.vx;actor\.vz=enbu\.vz/);
  assert.doesNotMatch(source,/presentationVariant|authored-slash-variants/);
});

test('slash v2 remains the dynamic baseline: low load, forward release and full-body braking',()=>{
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
