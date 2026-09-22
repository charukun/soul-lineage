import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const stage=readFileSync(new URL('../src/review/battle/stage.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../review/battle/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/review/battle/index.css',import.meta.url),'utf8');

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


test('現行review-battleはカメラ操作を右上の専用ホストへ常設する',()=>{
  assert.match(html,/class="battle-camera-control-host" data-camera-control-host/);
  assert.doesNotMatch(html,/class="camera-zoom"/);
  assert.match(stage,/querySelector\?\.\('\[data-camera-control-host\]'\)/);
  assert.match(stage,/container:cameraHost/);
  assert.match(stage,/cameraControl\.element\.dataset\.reviewBattleCamera='true'/);
  assert.match(css,/\.battle-camera-control-host\{/);
  assert.match(css,/right:max\(8px,env\(safe-area-inset-right\)\)/);
  assert.match(css,/z-index:40/);
  assert.match(css,/\.battle-camera-control-host>\.snap-camera-control\{/);
});
