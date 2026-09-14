import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyStylizedArtProfile, stylizedArtDiagnostics, stylizedGeometrySegments } from '../src/stylized-art.js';

test('prop profile clamps PBR materials and tags meshes without replacing geometry', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const original = new THREE.MeshStandardMaterial({ roughness: .2, metalness: .9 });
  const mesh = new THREE.Mesh(geometry, original);
  const root = new THREE.Group(); root.add(mesh);
  const result = applyStylizedArtProfile(root, 'prop');
  assert.equal(result.profile.id, 'prop');
  assert.equal(result.meshes, 1);
  assert.equal(mesh.geometry, geometry);
  assert.notEqual(mesh.material, original);
  assert.equal(mesh.material.roughness, .6);
  assert.equal(mesh.material.metalness, .24);
  assert.equal(mesh.material.flatShading, true);
  assert.equal(mesh.userData.stylizedArtProfile, 'prop');
  assert.equal(root.userData.stylizedArt.profileId, 'prop');
  geometry.dispose(); original.dispose(); mesh.material.dispose();
});

test('pooled mode preserves shared material identity while applying the profile once', () => {
  const material = new THREE.MeshStandardMaterial({ roughness: .1, metalness: .7 });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), material), new THREE.Mesh(new THREE.BoxGeometry(), material));
  const result = applyStylizedArtProfile(root, 'npc', { cloneMaterials: false });
  assert.equal(result.materials, 1);
  assert.equal(root.children[0].material, material);
  assert.equal(root.children[1].material, material);
  assert.equal(material.roughness, .48);
  assert.equal(material.metalness, .28);
  assert.deepEqual(stylizedArtDiagnostics(root).byProfile, { npc: 2 });
  root.children.forEach(mesh => mesh.geometry.dispose()); material.dispose();
});

test('procedural segment requests respect role budgets', () => {
  assert.equal(stylizedGeometrySegments('hero', 32), 16);
  assert.equal(stylizedGeometrySegments('enemy', 32), 10);
  assert.equal(stylizedGeometrySegments('distant', 32), 6);
  assert.equal(stylizedGeometrySegments('enemy', 4), 4);
});