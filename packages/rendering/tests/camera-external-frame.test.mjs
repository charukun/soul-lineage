import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { externalCameraShot } from '../src/camera-external-frame.js';
import { createCameraDirector } from '../src/camera-director.js';
import { length, subtract, radians, angleDelta } from '../src/camera/math.js';
const subject={id:'hero',position:{x:0,y:0,z:0},yaw:1.2,height:3,radius:1};
test('external 3D frame preserves focal-plane coverage with perspective at either profile FOV',()=>{
  for(const fov of [40,34]){
    const input={position:{x:8,y:22,z:23},lookTarget:{x:0,y:1,z:0},worldHeight:23,fov,yawOffset:.4};
    const shot=externalCameraShot(input),distance=length(subtract(shot.position,shot.lookTarget));
    assert.ok(Math.abs(distance*2*Math.tan(radians(fov)/2)-23)<1e-8);assert.equal(shot.fov,fov);
    assert.equal(input.position.x,8);assert.equal(subject.yaw,1.2);
  }
});
test('legacy/driven renderer handoff uses one director and shortest-path transition without resetting ownership',()=>{
  const director=createCameraDirector();const before=director.update({actor:subject,mode:'exploration',space:'frontier',yaw:3.1},0);
  const authoredShot=externalCameraShot({position:{x:-.5,y:12,z:-20},lookTarget:{x:0,y:1,z:0},worldHeight:23});
  const after=director.update({actor:subject,mode:'combat',space:'frontier',authoredShot},.016);
  assert.equal(after.transition.from,'exploration');assert.equal(after.transition.to,'combat');assert.equal(after.transition.progress,0);
  assert.ok(Math.abs(angleDelta(before.yaw,after.yaw))<.065);assert.equal(after.profile,'current3d');
  const resumed=director.update({actor:subject,mode:'exploration',space:'frontier'},.016);assert.equal(resumed.transition.from,'combat');assert.ok(Number.isFinite(resumed.position.x));
});
test('RINNE passes its director adapter into the existing driven renderer; native demos remain independent',()=>{
  const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
  const wrapper=read('../../../apps/rinne/src/rebuild/johakyu-world-renderer.js');
  const runtime=read('../../johakyu-presentation/src/runtime.js');
  const adapter=read('../../../apps/rinne/src/rebuild/presentation-camera.js');
  assert.match(wrapper,/cameraPresentation:view\.presentationCamera/);
  assert.match(runtime,/presentationPort&&cameraPresentation\?new THREE\.PerspectiveCamera/);
  assert.match(runtime,/cameraPresentation\.presentExternal/);
  assert.match(runtime,/camera\.isPerspectiveCamera/);
  assert.match(adapter,/externalCameraShot/);assert.match(adapter,/renderer: source/);
});
