import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battle2CameraWorldHeight,inspirationShotWeight} from '../src/battle2-camera-math.js';
import {tiltCameraOffsetForZoom} from '@soul/rendering/snap-camera-control';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('序破急バトルビューは目玉操作を使い縦スライダーを生成しない',()=>{
  const html=read('battle2.html'),css=read('src/battle2.css'),stage=read('src/nocturne-stage.js'),controller=read('src/nocturne/johakyu-p7-controller.js'),camera=read('src/battle2-camera.js');
  assert.match(html,/data-battle2-camera-host/);
  assert.match(css,/\.battle2-camera-control-host\{/);
  assert.match(css,/right:max\(8px,env\(safe-area-inset-right\)\)/);
  assert.match(css,/width:50px;height:50px;pointer-events:auto/);
  assert.match(css,/position:absolute!important;inset:0!important;left:0!important;top:0!important/);
  assert.match(stage,/createBattle2CameraPresentation\(\{stage,world\}\)/);
  assert.doesNotMatch(stage,/createCameraPositionControl|cameraPositionControl/);
  assert.match(stage,/cameraPresentation,movementInput,onMeta:updateSequence/);
  assert.match(stage,/cameraPresentation\.dispose\(\)/);
  assert.match(controller,/createDrivenBattleRuntime\(\{world,effects,stage,sound,notify,signal,cameraPresentation\}\)/);
  assert.match(camera,/createCameraDirector\(\{profile:'current3d'\}\)/);
  assert.match(camera,/createSnapCameraControl/);
  assert.match(camera,/tiltCameraOffsetForZoom\(/);
  assert.doesNotMatch(camera,/cameraPositionControl/);
  assert.match(camera,/externalCameraShot/);
  assert.match(camera,/applyCameraPresentation\(camera,presentation\)/);
  assert.match(camera,/world\.dataset\.cameraProjection='perspective'/);
});

test('縦スワイプのズーム値はlegacy framingのworldHeightへ反映する',()=>{
  assert.equal(battle2CameraWorldHeight(31,1),31);
  assert.equal(battle2CameraWorldHeight(31,.58),17.98);
  assert.equal(battle2CameraWorldHeight(31,1.65),51.15);
  assert.equal(battle2CameraWorldHeight(31,9),51.15);
  assert.equal(battle2CameraWorldHeight(undefined,1),undefined);
});

test('目玉ボタンの近距離ズームで視線が水平へ近づく',()=>{
  const far=tiltCameraOffsetForZoom({x:0,y:22,z:23},1);
  const near=tiltCameraOffsetForZoom({x:0,y:22,z:23},1+(.58-1)*1.9);
  assert.ok(Math.atan2(near.y,23)<Math.atan2(far.y,23));
  assert.ok(Math.atan2(near.y,23)<=Math.PI/12+.001);
});

test('閃きカメラは初回発動に合わせて寄り、戦闘時間を止めずに戻る',()=>{
  assert.ok(inspirationShotWeight(0,1.45)>0);
  assert.equal(inspirationShotWeight(.4,1.45),1);
  assert.ok(inspirationShotWeight(1.2,1.45)<1);
  assert.equal(inspirationShotWeight(1.45,1.45),0);
  const stage=read('src/nocturne-stage.js'),camera=read('src/battle2-camera.js');
  assert.match(stage,/cameraPresentation\.beginInspiration\(row,/);
  assert.match(camera,/framedMode='combat'/);
  assert.doesNotMatch(camera,/timeScale|pause\(/);
});
