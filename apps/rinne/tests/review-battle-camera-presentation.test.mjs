import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const stage=readFileSync(new URL('../src/review/battle/stage.js',import.meta.url),'utf8');

test('序破急バトルは共有Camera Directorを実カメラ経路として使う',()=>{
  assert.match(stage,/createCameraDirector\(\{profile:'current3d'\}\)/);
  assert.match(stage,/cameraDirector\.update\(cameraInput,step\)/);
  assert.match(stage,/applyCameraPresentation\(camera,presentation\)/);
  assert.match(stage,/actorScreenSafety\(camera,target\?\[actor,target\]:\[actor\]\)/);
  assert.match(stage,/combatFrame:\{look:frame\.look,offset\}/);
  assert.match(stage,/yawOffset:cameraOrbit/);
  assert.match(stage,/framing:\{zoom:cameraZoom\}/);
  assert.match(stage,/externalCameraShot\(\{position,lookTarget:frame\.look,fov:fovTarget\}\)/);
  assert.match(stage,/canvas\.dataset\.cameraDirector='shared'/);
  assert.doesNotMatch(stage,/camera\.position\.lerp\(cameraTargetPosition/);
});
