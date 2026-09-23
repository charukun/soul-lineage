import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battle2CameraWorldHeight} from '../src/battle2-camera-math.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('序破急バトルビューは旧カメラ操作を持たず共通スライダーでズームする',()=>{
  const html=read('battle2.html'),css=read('src/battle2.css'),stage=read('src/nocturne-stage.js'),controller=read('src/nocturne/johakyu-p7-controller.js'),camera=read('src/battle2-camera.js');
  assert.doesNotMatch(html,/data-battle2-camera-host/);
  assert.doesNotMatch(css,/\.battle2-camera-control-host/);
  assert.match(stage,/createCameraPositionControl\(/);
  assert.match(stage,/onChange:value=>cameraPresentation\.setZoom\(/);
  assert.match(stage,/cameraPresentation,onMeta:updateSequence/);
  assert.match(stage,/cameraPresentation\.dispose\(\)/);
  assert.match(controller,/createDrivenBattleRuntime\(\{world,effects,stage,sound,notify,signal,cameraPresentation\}\)/);
  assert.match(camera,/createCameraDirector\(\{profile:'current3d'\}\)/);
  assert.doesNotMatch(camera,/createSnapCameraControl|snap-camera-control/);
  assert.match(camera,/setZoom\(value\)/);
  assert.match(camera,/externalCameraShot/);
  assert.match(camera,/applyCameraPresentation\(camera,presentation\)/);
  assert.match(camera,/world\.dataset\.cameraProjection='perspective'/);
});

test('共通スライダーのズーム値はworldHeightへ反映する',()=>{
  assert.equal(battle2CameraWorldHeight(31,1),31);
  assert.equal(battle2CameraWorldHeight(31,.58),17.98);
  assert.equal(battle2CameraWorldHeight(31,1.65),51.15);
  assert.equal(battle2CameraWorldHeight(31,9),51.15);
  assert.equal(battle2CameraWorldHeight(undefined,1),undefined);
});
