import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCameraDirector } from '../src/camera-director.js';
import { measureCameraSubject, applyCameraPresentation, actorScreenSafety, actorSilhouetteSamples } from '../src/camera-presentation-three.js';
import { createForegroundOcclusionFader } from '../src/foreground-occlusion.js';
test('THREE adapter uses measured creature bounds, projects feet/head and leaves yaw/weapon transforms intact', () => {
  const creature = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 2), new THREE.MeshBasicMaterial()); creature.position.set(0, 2.5, 0); creature.rotation.y = 1.23;
  const subject = measureCameraSubject(creature, { id: 'quadruped', position: { x: 0, y: 0, z: 0 }, weaponRadius: 2 });
  assert.equal(subject.height, 5); assert.equal(subject.yaw, 1.23); assert.equal(actorSilhouetteSamples(subject).length, 3);
  const d = createCameraDirector(), camera = new THREE.PerspectiveCamera(43, .48, .08, 650);
  const state = d.update({ actor: subject, aspect: camera.aspect }); applyCameraPresentation(camera, state);
  const safety = actorScreenSafety(camera, [subject, { ...subject, id: 'overlap' }], .5);
  assert.equal(creature.rotation.y, 1.23); assert.equal(camera.fov, 40); assert.equal(camera.isPerspectiveCamera, true);
  assert.ok(safety.actors[0].screenHeight > 0); assert.ok(safety.actors[0].edgeMargin >= 0); assert.ok(safety.actors[0].inFront);
  assert.ok(Math.abs(safety.overlaps[0].ratio - 1) < 1e-7); assert.equal(safety.occludedRatio, .5);
  assert.throws(() => applyCameraPresentation(new THREE.OrthographicCamera(), state)); creature.geometry.dispose(); creature.material.dispose();
});
test('camera-relative movement axes stay orthogonal through every shot transition', () => {
  const d = createCameraDirector(), camera = new THREE.PerspectiveCamera(43, 1, .08, 100);
  const actor = { id: 'player', position: { x: 0, y: 0, z: 0 }, height: 1.75, yaw: -1.2 };
  for (const mode of ['exploration', 'combat', 'interior', 'conversation', 'exploration']) for (let i = 0; i < 50; i++) {
    applyCameraPresentation(camera, d.update({ actor, mode, yaw: i * .04 }, .016));
    const forward = camera.getWorldDirection(new THREE.Vector3()); forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    assert.ok(Math.abs(forward.dot(right)) < 1e-7); assert.ok(Math.abs(forward.length() - 1) < 1e-7); assert.equal(actor.yaw, -1.2);
  }
});
test('multiple silhouette samples and roots fade buildings/walls but not shared materials', () => {
  const material = new THREE.MeshStandardMaterial(), roots = [new THREE.Group(), new THREE.Group()];
  const low = new THREE.Mesh(new THREE.BoxGeometry(2, .7, 1), material); low.position.set(0, .35, 4); roots[0].add(low);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), material); upper.position.set(0, 2, 5); roots[1].add(upper);
  const camera = new THREE.PerspectiveCamera(40, 1, .08, 100); camera.position.set(0, 1.6, 10); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
  const fader = createForegroundOcclusionFader({ sampleInterval: 0, fadeSpeed: 100, restoreSpeed: 100 });
  const state = fader.update({ camera, targets: [{ x: 0, y: .1, z: 0 }, { x: 0, y: 2.5, z: 0 }], occluderRoots: roots, dt: .1 });
  assert.ok(state.occluded >= 1); assert.ok(state.occludedRatio > 0); assert.equal(material.opacity, 1);
  fader.update({ enabled: false, dt: .1 }); assert.equal(low.material, material); assert.equal(upper.material, material); fader.dispose(); low.geometry.dispose(); upper.geometry.dispose(); material.dispose();
});
test('only hit forest instances fade and every original matrix/material is restored', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(1, 3, 1), material = new THREE.MeshStandardMaterial();
  const forest = new THREE.InstancedMesh(geometry, material, 2); root.add(forest);
  const first = new THREE.Matrix4().makeTranslation(0, 1.5, 4), second = new THREE.Matrix4().makeTranslation(8, 1.5, 4); forest.setMatrixAt(0, first); forest.setMatrixAt(1, second); root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(40, 1, .08, 100); camera.position.set(0, 1.5, 10); camera.lookAt(0, 1.5, 0); camera.updateMatrixWorld();
  const fader = createForegroundOcclusionFader({ sampleInterval: 0, fadeSpeed: 100, restoreSpeed: 100 });
  for (let i = 0; i < 4; i++) {
    const s = fader.update({ camera, target: { x: 0, y: 1.5, z: 0 }, instanceOccluders: [forest], dt: .1 }); assert.equal(s.instanceProxies, 1); assert.equal(s.occluded, 1); assert.equal(s.occludedRatio, 1);
    const unaffected = new THREE.Matrix4(); forest.getMatrixAt(1, unaffected); assert.deepEqual(unaffected.elements, second.elements); assert.equal(forest.material, material);
  }
  fader.revealAll(); const restored = new THREE.Matrix4(); forest.getMatrixAt(0, restored); assert.deepEqual(restored.elements, first.elements); assert.equal(root.children.length, 1);
  fader.update({ camera, target: { x: 0, y: 1.5, z: 0 }, instanceOccluders: [forest], dt: .1 }); fader.dispose(); forest.getMatrixAt(0, restored); assert.deepEqual(restored.elements, first.elements); assert.equal(material.opacity, 1); assert.equal(root.children.length, 1); geometry.dispose(); material.dispose();
});

test('large creatures and long weapons fit conservative projected bounds on portrait and landscape cameras', () => {
  const actor = { id: 'winged-boss', position: { x: 0, y: 0, z: 0 }, height: 8, radius: 2, weaponRadius: 7.2 };
  for (const aspect of [.48, 1.4]) for (const mode of ['exploration', 'interior']) {
    const camera = new THREE.PerspectiveCamera(43, aspect, .08, 650);
    applyCameraPresentation(camera, createCameraDirector().update({ actor, aspect, mode, interiorPolicy: 'interiorDiorama' }));
    const safety = actorScreenSafety(camera, [actor]); assert.ok(safety.actors[0].edgeMargin >= .065, JSON.stringify(safety));
  }
});
