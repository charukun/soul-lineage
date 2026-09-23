import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraForMotion,MOTION_CAMERA} from '../src/motion-camera.js';

test('each motion selects its own framing and ordinary combat returns to the shared view',()=>{
 const hero={canonicalRow:{action:{finisher:true,techniqueId:'finisher.execution',progress:.4}}};
 assert.equal(cameraForMotion(hero).shot,MOTION_CAMERA['finisher.execution']);
 hero.canonicalRow.action=null;hero.canonicalRow.phaseCue={phase:'zanshin',progress:.5};
 assert.equal(cameraForMotion(hero).shot,MOTION_CAMERA['phase:zanshin']);
 assert.ok(cameraForMotion(hero).shot.distance>MOTION_CAMERA['finisher.execution'].distance);
 hero.canonicalRow.phaseCue=null;assert.equal(cameraForMotion(hero),null);
});
