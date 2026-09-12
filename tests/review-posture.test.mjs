import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Contract test doubles: real asset/Three.js visual verification is a separate browser gate.
const source = await readFile(new URL('../apps/rinne/src/review/posture-preview.js', import.meta.url), 'utf8');
const fixture = `
class Track { constructor(name,times,values){Object.assign(this,{name,times,values});} }
class Clip { constructor(name,duration,tracks){Object.assign(this,{name,duration,tracks});} }
const THREE={QuaternionKeyframeTrack:Track,VectorKeyframeTrack:Track,AnimationClip:Clip};
`;
const {bakePosturePreview,postureAmount,POSTURE_DURATION} = await import('data:text/javascript;base64,' + Buffer.from(source.replace("import { THREE } from '@soul/rendering';", fixture)).toString('base64'));
function runtimeFixture(fail = false) {
  let amount = 0;
  const calls = [], bones = Object.fromEntries(['hips','rightHand','leftHand'].map(uuid => [uuid,{uuid,position:{toArray:()=>[0,1,0]},quaternion:{toArray:()=>[amount,0,0,1]}}]));
  return {calls, current:{bones},api:{weapons:{}},resetRoot(){},resetBones(){},sample(actor,at,x,z,commit){
    assert.equal(actor.weapon,'sword');assert.equal(commit,false);assert.equal(actor.attack,undefined);
    assert.ok(this.api.weapons.sword);amount=actor.weaponDraw;calls.push(amount);if(fail)throw Error('fixture failure');
  }};
}
test('native draw and sheathe progress, endpoint holds and transfer are deterministic', () => {
  assert.equal(postureAmount('draw',0),0);assert.equal(postureAmount('draw',POSTURE_DURATION),1);
  assert.equal(postureAmount('sheathe',0),1);assert.equal(postureAmount('sheathe',POSTURE_DURATION),0);
  assert.ok(Math.abs(postureAmount('draw',.425)-.25)<1e-9);
  assert.ok(Math.abs(postureAmount('sheathe',.975)-.25)<1e-9);
});
test('bakes two distinct motions by calling the native runtime, not an attack alias', () => {
  const runtime=runtimeFixture(),rows=bakePosturePreview(runtime);
  assert.equal(rows.length,2);assert.equal(runtime.calls.length,170);
  assert.deepEqual(rows.map(row=>row.kind),['draw','sheathe']);
  assert.ok(rows[0].name.includes('抜刀'));assert.ok(rows[1].name.includes('納刀'));
  for(const row of rows){assert.equal(row.clip.duration,1.4);assert.equal(row.clip.tracks.length,4);assert.equal(row.clip.tracks[0].times.length,85);}
  assert.equal(rows[0].clip.tracks[0].values[0],0);assert.equal(rows[0].clip.tracks[0].values.at(-4),1);
  assert.equal(rows[1].clip.tracks[0].values[0],1);assert.equal(rows[1].clip.tracks[0].values.at(-4),0);
  assert.equal(runtime.api.weapons.sword,undefined);
});
test('existing runtime weapon metadata is restored even after failure', () => {
  const runtime=runtimeFixture(true),weapon={width:.07,base:.04,tip:1.2};runtime.api.weapons.sword=weapon;
  assert.throws(()=>bakePosturePreview(runtime),/fixture failure/);assert.equal(runtime.api.weapons.sword,weapon);
});
test('incompatible skeletons do not get mislabeled posture clips', () => {
  assert.deepEqual(bakePosturePreview({current:{bones:{}}}),[]);
});
