import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { classifyFrameBottleneck } from '../src/gpu-timer.js';
import { createGpuAwareQualityGovernor, profileForBottleneck } from '../src/gpu-aware-quality.js';
import { compressedAssetCapabilities } from '../src/compressed-gltf.js';
import { createConservativeOcclusionCuller } from '../src/occlusion.js';
import { batchStaticMeshes, remapGeometryUVToAtlas, validateTextureAtlasManifest } from '../src/instance-atlas.js';
import { comparePerformanceSnapshots, createPerformanceRecorder } from '../src/performance-lab.js';
import { createVisualDistanceStreamer } from '../src/world-streaming.js';

test('GPU bottleneck classification separates CPU and GPU pressure', () => {
  assert.equal(classifyFrameBottleneck({ frameMs: 26, gpuMs: 22, targetFps: 60 }), 'gpu');
  assert.equal(classifyFrameBottleneck({ frameMs: 26, gpuMs: 4, targetFps: 60 }), 'cpu');
  assert.equal(classifyFrameBottleneck({ frameMs: 12, gpuMs: 8, targetFps: 60 }), 'healthy');
  const cpu = profileForBottleneck({ level: 2, renderScale: .8, shadowScale: .5, textureAnisotropy: 2, vegetationScale: .68, streamDistanceScale: .84 }, 'cpu');
  assert.ok(cpu.renderScale >= .9);
  assert.ok(cpu.vegetationScale <= .5);
});

test('GPU-aware governor retains hysteresis while exposing pressure axis', () => {
  const governor = createGpuAwareQualityGovernor({ targetFps: 60, degradeFrames: 2, recoverFrames: 3, cooldownFrames: 0 });
  governor.observeFrame(.05, 3);
  const low = governor.observeFrame(.05, 3);
  assert.equal(low.bottleneck, 'cpu');
  assert.equal(low.level, 1);
  assert.equal(low.profile.pressureAxis, 'cpu');
});

test('compressed asset capabilities prefer Meshopt and KTX2', () => {
  const result = compressedAssetCapabilities();
  assert.equal(result.meshopt, true);
  assert.equal(result.preferredTextureExtension, 'ktx2');
  assert.equal(result.preferredGeometryCompression, 'EXT_meshopt_compression');
});

test('conservative occlusion requires repeated full-ray blocking and preserves external hidden state', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 100); camera.position.set(0, 0, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  const occluder = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 1), new THREE.MeshBasicMaterial()); occluder.position.z = 1; occluder.updateMatrixWorld(true);
  const candidate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()); candidate.position.z = -5; candidate.updateMatrixWorld(true);
  const culler = createConservativeOcclusionCuller({ maxChecksPerUpdate: 1, minDistance: 1, hiddenConfirmations: 2 });
  culler.update({ camera, candidates: [candidate], occluders: [occluder] });
  assert.equal(candidate.visible, true);
  culler.update({ camera, candidates: [candidate], occluders: [occluder] });
  assert.equal(candidate.visible, false);
  const externallyHidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); externallyHidden.position.z=-4; externallyHidden.visible=false; externallyHidden.updateMatrixWorld(true);
  culler.update({ camera, candidates: [externallyHidden], occluders: [occluder] });
  assert.equal(externallyHidden.visible, false);
});

test('distance streaming and occlusion never resurrect each others hidden state', () => {
  const root=new THREE.Group(), candidate=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()); candidate.position.z=-30; root.add(candidate); root.updateMatrixWorld(true);
  const streamer=createVisualDistanceStreamer({baseDistance:5,hysteresis:1});
  streamer.update(root,{x:0,y:0,z:0},1);
  assert.equal(candidate.userData.visualStreamVisible,false); assert.equal(candidate.visible,false);
  candidate.userData.occluded=true;
  streamer.update(root,{x:0,y:0,z:-30},1);
  assert.equal(candidate.userData.visualStreamVisible,true); assert.equal(candidate.visible,false);
  candidate.userData.occluded=false;
  streamer.update(root,{x:0,y:0,z:-30},1);
  assert.equal(candidate.visible,true);
});

test('static batching consolidates exact repeats and atlas UV remap stays inside slot', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  for (let i = 0; i < 5; i++) { const mesh = new THREE.Mesh(geometry, material); mesh.position.x = i * 2; root.add(mesh); }
  const result = batchStaticMeshes(root, { minInstances: 4 });
  assert.equal(result.batches, 1); assert.equal(result.instances, 5);
  assert.ok(root.children.some(node => node.isInstancedMesh));
  const manifest={ width: 256, height: 256, slots: [{ id: 'a', x: 64, y: 64, width: 128, height: 128 }] };
  validateTextureAtlasManifest(manifest);
  const remapped=remapGeometryUVToAtlas(new THREE.PlaneGeometry(1,1),manifest,'a'),uv=remapped.attributes.uv;
  for(let i=0;i<uv.count;i++){assert.ok(uv.getX(i)>=.25&&uv.getX(i)<=.75);assert.ok(uv.getY(i)>=.25&&uv.getY(i)<=.75);}
});

test('performance recorder detects frame/GPU regressions', () => {
  const baseline = createPerformanceRecorder(); const current = createPerformanceRecorder();
  for (let i = 0; i < 30; i++) baseline.sample({ frameMs: 16, gpuMs: 10, drawCalls: 50, triangles: 10000, textureBytes: 1_000_000 });
  for (let i = 0; i < 30; i++) current.sample({ frameMs: 23, gpuMs: 16, drawCalls: 60, triangles: 11000, textureBytes: 1_050_000 });
  const report = comparePerformanceSnapshots(baseline.snapshot(), current.snapshot());
  assert.equal(report.pass, false);
  assert.ok(report.regressions.some(row => row.metric === 'frame.p95Ms'));
});
