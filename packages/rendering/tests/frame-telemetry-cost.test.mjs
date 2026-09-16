import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPerformanceRecorder} from '../src/performance-lab.js';
import {applyTextureQuality} from '../src/texture-quality.js';

test('deferred frame telemetry retains every metric without aggregating in the frame loop', () => {
  const eager = createPerformanceRecorder({maxSamples:4});
  const deferred = createPerformanceRecorder({maxSamples:4,snapshotOnSample:false});
  const snapshot = deferred.snapshot;
  let summaries = 0;
  deferred.snapshot = () => { summaries++; return snapshot(); };
  for (let i=0;i<9;i++) {
    const row = {frameMs:12+i*7,gpuMs:i*2,drawCalls:90+i,triangles:800+i,
      textureBytes:4096+i,transparentDrawCalls:i,transparentTriangleUpperBound:200+i};
    assert.equal(eager.sample(row).samples, Math.min(i+1,4));
    assert.equal(deferred.sample(row), undefined);
  }
  eager.sample({frameMs:NaN,gpuMs:-1});
  deferred.sample({frameMs:NaN,gpuMs:-1});
  assert.equal(summaries,0,'sampling must not compute a percentile report');
  const {startedAt:before,...expected} = eager.snapshot();
  const {startedAt:after,...actual} = deferred.snapshot();
  assert.deepEqual(actual,expected);
  assert.equal(actual.samples,4);
  assert.equal(actual.frame.longFrames,3);
  assert.equal(summaries,1);
  deferred.reset();
  assert.equal(deferred.snapshot().samples,0);
  assert.equal(deferred.snapshot().frame.longFrames,0);
});

test('reapplying texture quality avoids uploads but preserves real sampler and image updates', () => {
  const texture = new THREE.Texture({width:64,height:64});
  const material = new THREE.MeshStandardMaterial({map:texture,roughnessMap:texture});
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(),material),new THREE.Mesh(new THREE.BoxGeometry(),material));
  const result = applyTextureQuality(root,{anisotropy:4});
  assert.deepEqual(result,{textures:1,anisotropy:4});
  const uploaded = texture.version;
  for (let i=0;i<120;i++) applyTextureQuality(root,{anisotropy:4});
  assert.equal(texture.version,uploaded,'unchanged quality must not dirty the GPU texture');
  texture.needsUpdate = true;
  const imageUpdate = texture.version;
  applyTextureQuality(root,{anisotropy:4});
  assert.equal(texture.version,imageUpdate,'a caller-owned image update must remain pending');
  applyTextureQuality(root,{anisotropy:2});
  assert.equal(texture.anisotropy,2);
  assert.equal(texture.version,imageUpdate+1);
  applyTextureQuality(root,{anisotropy:0});
  assert.equal(texture.anisotropy,1);
  const clamped = texture.version;
  applyTextureQuality(root,{anisotropy:1});
  assert.equal(texture.version,clamped);
});
