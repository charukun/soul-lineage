import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createForegroundOcclusionFader } from '../src/occlusion.js';

function blocker(root, material, { x = 0, z = 0, disabled = false } = {}) {
  const group = new THREE.Group();
  group.position.set(x, 1.15, z);
  group.userData.occlusionFadeDisabled = disabled;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), material);
  group.add(mesh);
  root.add(group);
  return { group, mesh };
}

test('foreground occlusion fades every blocking top-level object without mutating shared materials', () => {
  const root = new THREE.Group();
  const shared = new THREE.MeshStandardMaterial({ color: 0x998866 });
  const near = blocker(root, shared, { z: 7 });
  const far = blocker(root, shared, { z: 4 });
  const offAxis = blocker(root, shared, { x: 5, z: 5 });
  const optedOut = blocker(root, shared, { z: 2, disabled: true });
  const camera = new THREE.PerspectiveCamera(43, 1, .08, 100);
  camera.position.set(0, 1.15, 10);
  camera.lookAt(0, 1.15, 0);
  camera.updateMatrixWorld(true);
  root.updateMatrixWorld(true);

  const fader = createForegroundOcclusionFader({ fadedOpacity: .25, fadeSpeed: 100, restoreSpeed: 100, sampleInterval: 0 });
  const state = fader.update({ camera, target: new THREE.Vector3(0, 1.15, 0), occluderRoot: root, enabled: true, dt: .1 });

  assert.equal(state.occluded, 2);
  assert.notEqual(near.mesh.material, shared);
  assert.notEqual(far.mesh.material, shared);
  assert.equal(offAxis.mesh.material, shared);
  assert.equal(optedOut.mesh.material, shared);
  assert.equal(shared.opacity, 1);
  assert.equal(near.mesh.material.opacity, .25);
  assert.equal(far.mesh.material.opacity, .25);
  assert.equal(near.mesh.material.alphaHash, true);
  assert.equal(near.mesh.material.transparent, false);
  assert.equal(near.mesh.material.depthWrite, true);

  const restored = fader.update({ camera, target: new THREE.Vector3(0, 1.15, 0), occluderRoot: root, enabled: false, dt: .1 });
  assert.equal(restored.occluded, 0);
  assert.equal(near.mesh.material, shared);
  assert.equal(far.mesh.material, shared);

  fader.dispose();
  shared.dispose();
  for (const object of root.children) object.traverse(node => node.geometry?.dispose?.());
});
