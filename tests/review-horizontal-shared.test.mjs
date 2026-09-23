import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('review 3D surfaces share renderer, camera preset, and resource lifetime primitives',async()=>{
  const [rendering,motion,assets,objects,effects,thumbnails]=await Promise.all([
    read('packages/rendering/src/review/preview-stage.js'),
    read('apps/rinne/src/review-motion.js'),
    read('apps/rinne/src/review-asset-library.js'),
    read('apps/rinne/src/review-object-library.js'),
    read('apps/rinne/src/review-effects.js'),
    read('apps/rinne/src/review/shared/runtime-thumbnail.js'),
  ]);
  assert.match(rendering,/export function createReviewCameraPresetController/);
  assert.match(rendering,/export function disposeReviewObject/);
  for(const source of [motion,assets,objects])assert.match(source,/createReviewCameraPresetController/);
  for(const source of [motion,assets,objects,thumbnails])assert.match(source,/disposeReviewObject/);
  for(const source of [motion,assets,objects,effects])assert.match(source,/createReviewRenderer/);
  assert.doesNotMatch(assets,/new THREE\.WebGLRenderer/);
  assert.doesNotMatch(effects,/const canvas=q\('fx-stage'\),renderer=new THREE\.WebGLRenderer/);
  assert.doesNotMatch(motion,/function disposeScene/);
});

test('static thumbnails and review status updates use shared-ui primitives',async()=>{
  const [controls,motion,assets,objects]=await Promise.all([
    read('packages/shared-ui/src/review/controls.css'),
    read('apps/rinne/src/review-motion.js'),
    read('apps/rinne/src/review-asset-library.js'),
    read('apps/rinne/src/review-object-library.js'),
  ]);
  assert.match(controls,/\.review-static-thumbnail\{/);
  for(const source of [motion,assets,objects])assert.match(source,/createReviewSvgThumbnail/);
  for(const source of [motion,assets,objects])assert.match(source,/setReviewStatus/);
  assert.doesNotMatch(motion,/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg','svg'\)/);
  assert.doesNotMatch(assets,/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg','svg'\)/);
});

test('review metadata and stage controls use shared semantic contracts',async()=>{
  const [motion,objects,effects,sound]=await Promise.all([
    read('apps/rinne/review-motion.html'),
    read('apps/rinne/review-objects.html'),
    read('apps/rinne/review-effects.html'),
    read('apps/rinne/review-sound.html'),
  ]);
  assert.match(motion,/motion-meta review-surface__meta/);
  assert.match(objects,/object-details review-surface__meta/);
  assert.match(effects,/controls" data-review-stage-control/);
  assert.equal((sound.match(/data-review-stage-control/g)||[]).length,2);
});
