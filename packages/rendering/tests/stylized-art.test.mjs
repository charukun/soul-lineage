import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyStylizedArtProfile,
  compareStylizedSilhouettes,
  installStylizedGeometryLOD,
  stylizedArtAudit,
  stylizedArtDiagnostics,
  stylizedGeometrySegments,
  stylizedSilhouetteMetrics,
} from '../src/stylized-art.js';

test('prop profile clamps PBR materials, assigns shared token and keeps source geometry', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const original = new THREE.MeshStandardMaterial({ roughness: .2, metalness: .9 });
  const mesh = new THREE.Mesh(geometry, original);
  const root = new THREE.Group(); root.add(mesh);
  const result = applyStylizedArtProfile(root, 'prop');
  assert.equal(result.profile.id, 'prop');
  assert.equal(result.meshes, 1);
  assert.equal(mesh.geometry, geometry);
  assert.notEqual(mesh.material, original);
  assert.equal(mesh.material.roughness, .8);
  assert.equal(mesh.material.metalness, .04);
  assert.equal(mesh.material.flatShading, true);
  assert.equal(mesh.material.userData.soulMaterialToken, 'surface.prop');
  assert.equal(mesh.userData.stylizedArtProfile, 'prop');
  assert.equal(root.userData.stylizedArt.profileId, 'prop');
  geometry.dispose(); original.dispose(); mesh.material.dispose();
});

test('pooled mode preserves shared material identity while applying shared response token once', () => {
  const material = new THREE.MeshStandardMaterial({ roughness: .1, metalness: .7 });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), material), new THREE.Mesh(new THREE.BoxGeometry(), material));
  const result = applyStylizedArtProfile(root, 'npc', { cloneMaterials: false });
  assert.equal(result.materials, 1);
  assert.equal(root.children[0].material, material);
  assert.equal(root.children[1].material, material);
  assert.equal(material.roughness, .66);
  assert.equal(material.metalness, .04);
  assert.equal(material.userData.soulMaterialToken, 'surface.npc');
  assert.deepEqual(stylizedArtDiagnostics(root).byProfile, { npc: 2 });
  root.children.forEach(mesh => mesh.geometry.dispose()); material.dispose();
});

test('static world geometry swaps to a real low triangle proxy only at distance', () => {
  const original = new THREE.SphereGeometry(1, 16, 12);
  const mesh = new THREE.Mesh(original, new THREE.MeshStandardMaterial());
  const root = new THREE.Group(); root.add(mesh); applyStylizedArtProfile(root, 'prop', { cloneMaterials: false });
  const result = installStylizedGeometryLOD(root, 'prop');
  assert.equal(result.installed, 1);
  assert.ok(result.sourceTriangles > result.proxyTriangles);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 0, 100); camera.updateMatrixWorld(true); root.updateMatrixWorld(true);
  mesh.onBeforeRender(null, null, camera, mesh.geometry, mesh.material, null);
  assert.notEqual(mesh.geometry, original);
  assert.equal(mesh.userData.stylizedLOD.current, 'proxy');
  camera.position.set(0, 0, 2); camera.updateMatrixWorld(true);
  mesh.onBeforeRender(null, null, camera, mesh.geometry, mesh.material, null);
  assert.equal(mesh.geometry, original);
  assert.equal(mesh.userData.stylizedLOD.current, 'full');
  mesh.__stylizedLODState.proxy.dispose(); original.dispose(); mesh.material.dispose();
});

test('silhouette metrics distinguish body envelopes and cohort comparison finds close shapes', () => {
  const a = new THREE.Group(), b = new THREE.Group(), c = new THREE.Group();
  a.add(new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshBasicMaterial()));
  b.add(new THREE.Mesh(new THREE.BoxGeometry(2.02, 4, 1.02), new THREE.MeshBasicMaterial()));
  c.add(new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1), new THREE.MeshBasicMaterial()));
  const ma = stylizedSilhouetteMetrics(a), mb = stylizedSilhouetteMetrics(b), mc = stylizedSilhouetteMetrics(c);
  assert.equal(ma.valid, true);
  assert.ok(Math.abs(ma.frontAspect - .5) < .02);
  const pairs = compareStylizedSilhouettes([{ id: 'a', silhouette: ma }, { id: 'b', silhouette: mb }, { id: 'c', silhouette: mc }], .03);
  assert.deepEqual(pairs.map(p => [p.a, p.b]), [['a', 'b']]);
});

test('art audit reports profile budgets, material coverage, LOD coverage and silhouette', () => {
  const root = new THREE.Group(); root.add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial()));
  applyStylizedArtProfile(root, 'environment', { cloneMaterials: false });
  installStylizedGeometryLOD(root, 'environment');
  const audit = stylizedArtAudit(root, 'environment');
  assert.equal(audit.profileId, 'environment');
  assert.equal(audit.materialTokens['surface.environment'], 1);
  assert.equal(audit.lod.installed, 1);
  assert.equal(audit.silhouette.valid, true);
  assert.ok(['pass', 'review'].includes(audit.gate));
});

test('procedural segment requests respect role budgets', () => {
  assert.equal(stylizedGeometrySegments('hero', 32), 16);
  assert.equal(stylizedGeometrySegments('enemy', 32), 10);
  assert.equal(stylizedGeometrySegments('distant', 32), 6);
  assert.equal(stylizedGeometrySegments('enemy', 4), 4);
});