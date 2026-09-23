import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraForMotion,MOTION_CAMERA} from '../src/motion-camera.js';

test('finisher exposes the defeated target and zanshin returns to a pulled-back frontal portrait',()=>{
 const hero={canonicalRow:{action:{finisher:true,techniqueId:'finisher.execution',progress:.4}}};
 const finisher=cameraForMotion(hero).shot;
 assert.equal(finisher,MOTION_CAMERA['finisher.execution']);
 assert.equal(finisher.basis,'target');
 assert.ok(finisher.targetBlend>=.6,'finisher centers the defeated target strongly enough to show its burst');
 assert.ok(finisher.angle>1,'finisher uses a side angle instead of looking through the hero');
 hero.canonicalRow.action=null;hero.canonicalRow.phaseCue={phase:'zanshin',progress:.5};
 const zanshin=cameraForMotion(hero).shot;
 assert.equal(zanshin,MOTION_CAMERA['phase:zanshin']);
 assert.equal(zanshin.basis,'actor');
 assert.equal(zanshin.targetBlend,0,'zanshin centers the hero rather than the defeated target');
 assert.equal(zanshin.angle,0,'zanshin is frontal to the hero');
 assert.ok(zanshin.distance>finisher.distance*1.8,'zanshin pulls well back from the finisher close-up');
 hero.canonicalRow.phaseCue=null;assert.equal(cameraForMotion(hero),null);
});
