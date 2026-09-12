import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readReviewState,reviewStateURL,applyMotionPolicy} from '../../src/review/review-state.js';
import {REVIEW_MOTION_INTEGRITY} from '../../src/review/review-motion-integrity.js';
import {WEAPON_PROFILES,createKatana} from '../../src/review/weapon-review-polish.js';
test('state URL round trip retains actual weapon, posture, paused seek, loop and camera',()=>{
 const state={...readReviewState(''),preset:'model.SHINO',clip:'技 / 流し斬り',mode:'combat',weaponId:'katana',weaponEnabled:true,loop:false,playing:false,time:.44,speed:.25,camera:'right',weaponX:15,weaponY:-20,weaponZ:30};
 const url=reviewStateURL('https://example.invalid/',state),round=readReviewState(url.searchParams);
 for(const key of Object.keys(state).filter(k=>k!=='shared'))assert.deepEqual(round[key],state[key],key);
 assert.equal(round.shared,true);
});
test('new motion selection applies metadata; restoration is separate and does not guess labels',()=>{
 const base={...readReviewState(''),weaponEnabled:true,weaponId:'staff'};
 const punch=applyMotionPolicy(base,{category:'unarmed',weapon:'none',posture:'combat',loop:false});
 assert.equal(punch.weaponEnabled,false);assert.equal(punch.mode,'combat');assert.equal(punch.loop,false);
 const slash=applyMotionPolicy(punch,{kind:'slash',posture:'combat',loop:false});assert.equal(slash.weaponId,'katana');assert.equal(slash.weaponEnabled,true);
 assert.deepEqual(applyMotionPolicy(base,null),base);
});
test('untrusted state inputs remain bounded and no unknown weapon is selected',()=>{
 const s=readReviewState('weaponId=bad&t=Infinity&weaponScale=-10&weaponX=99999&speed=NaN&camera=missing');
 assert.equal(s.time,0);assert.equal(s.weaponScale,.1);assert.equal(s.weaponX,360);assert.equal(s.weaponId,'katana');assert.equal(s.speed,1);assert.equal(s.camera,'three');
});
test('all 13 converted VRMA files match checked-in review bytes and hashes',()=>{
 assert.equal(Object.keys(REVIEW_MOTION_INTEGRITY).length,13);
 for(const[id,row]of Object.entries(REVIEW_MOTION_INTEGRITY)){
  const bytes=readFileSync(new URL(`../../public/simulator/assets/motions/${id}.vrma`,import.meta.url));
  assert.equal(bytes.length,row.bytes,id);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.reviewSHA256,id);
 }
});
test('all nine weapons have explicit grip definitions and support for two-handed models',()=>{
 assert.equal(Object.keys(WEAPON_PROFILES).length,9);
 for(const spec of Object.values(WEAPON_PROFILES)){assert.equal(spec.grip.length,3);assert.ok(spec.grip.every(Number.isFinite));assert.ok(spec.scale>0);}
 for(const id of ['greatsword','katana','greataxe','crossbow','staff'])assert.equal(WEAPON_PROFILES[id].support.length,3);
 const model=createKatana();assert.ok(model.children.length>=10);model.traverse(n=>{if(n.geometry)assert.ok([...n.geometry.attributes.position.array].every(Number.isFinite));});
});


test('sequence URL preserves repeated stages and final paused global time',()=>{
 const s={...readReviewState(''),sequence:['Tidebreak / Idle','Tidebreak / Attack','Tidebreak / Attack'],clip:'Tidebreak / Attack',time:6.9,playing:false,loop:false};
 const r=readReviewState(reviewStateURL('https://example.invalid/',s).searchParams);
 assert.deepEqual(r.sequence,s.sequence);assert.equal(r.time,s.time);assert.equal(r.playing,false);assert.equal(r.loop,false);
});
