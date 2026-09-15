import test from 'node:test';
import assert from 'node:assert/strict';
import * as Three from '../public/simulator/vendor/three.js';
import {PERFORMANCE_EVENTS,PERFORMANCE_SECONDS,samplePerformance} from '../public/simulator/src/sword-performance.js';
import {DIRECTIONAL_STEP_REFERENCE,classifyDirectionalStep,sampleDirectionalStep} from '../public/simulator/src/directional-step.js';
import {clearSwordArmTarget} from '../public/simulator/src/authored-slash.js';

test('30-second score visibly draws, performs, then sheathes inside the fixed duration',()=>{
  assert.equal(PERFORMANCE_SECONDS,30);
  const opening=samplePerformance(0),drawn=samplePerformance(1.099),closing=samplePerformance(29.25),finished=samplePerformance(30);
  assert.equal(opening.event.kind,'draw');
  assert.equal(opening.weaponDraw,0);
  assert.ok(drawn.weaponDraw>.99);
  assert.equal(closing.event.kind,'sheathe');
  assert.ok(closing.weaponDraw>.99);
  assert.equal(finished.event.kind,'sheathe');
  assert.equal(finished.weaponDraw,0);
  assert.equal(finished.attack,null);
});

test('directional movement is pinned, left-foot synchronized and covers back/side steps',()=>{
  assert.equal(DIRECTIONAL_STEP_REFERENCE.repository,'J-Ponzo/gltf-universal-animation-library');
  assert.match(DIRECTIONAL_STEP_REFERENCE.repositoryRevision,/^[0-9a-f]{40}$/);
  assert.equal(DIRECTIONAL_STEP_REFERENCE.license,'CC0-1.0');
  const samples=[0,.1,.2,.35,.5,.7,.85,1].map(p=>sampleDirectionalStep({step:'back-left'},p));
  assert.ok(samples.every(sample=>sample.leadFoot==='left'));
  for(let i=1;i<samples.length;i++)assert.ok(samples[i].travel>=samples[i-1].travel-1e-9);
  assert.equal(samples.at(-1).travel,1);
  assert.equal(classifyDirectionalStep({from:[0,0],to:[1,0],yaw:0}),'side-left');
  assert.equal(classifyDirectionalStep({from:[0,0],to:[0,-1],yaw:0}),'back');
  const moves=PERFORMANCE_EVENTS.filter(event=>event.kind==='move').map(event=>event.step);
  assert.ok(moves.some(step=>String(step).startsWith('back')));
  assert.ok(moves.some(step=>String(step).startsWith('side')));
});

test('sword arm targets keep a measured torso clearance envelope',()=>{
  const points={
    spine:new Three.Vector3(0,1,0),
    leftUpperArm:new Three.Vector3(.30,1,0),
    rightUpperArm:new Three.Vector3(-.30,1,0)
  };
  const runtime={point(_c,name){return points[name].clone();}};
  const character={root:{updateMatrixWorld(){}}};
  const right=clearSwordArmTarget(runtime,character,new Three.Vector3(0,.8,0),'right',1);
  assert.ok(right.z>=.095,'weapon arm target should be pushed in front of the ribcage');
  const left=clearSwordArmTarget(runtime,character,new Three.Vector3(0,.8,0),'left',1,{keepSide:true});
  assert.ok(left.x>.06,'free hand should remain on its own side of a compact torso');
  assert.ok(left.z>=.095);
});
