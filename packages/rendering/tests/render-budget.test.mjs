import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { auditTextureBudget, estimateTextureBytes } from '../src/texture-quality.js';
import { auditStaticBatchOpportunities } from '../src/instance-atlas.js';
import { auditSceneBudget, createRenderingBudgetSnapshot } from '../src/scene-budget.js';

function repeatedMeshes(root, count, geometry, material, { statefulAt = -1 } = {}) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `prop-${i}`;
    if (i === statefulAt) mesh.userData.stateful = true;
    root.add(mesh);
  }
}

test('texture budget identifies concrete oversized texture usage without mutating quality', () => {
  const root = new THREE.Group();
  const texture = new THREE.Texture();
  texture.name = 'village-hero-albedo.png';
  texture.image = { width: 4096, height: 4096 };
  texture.userData.source = '/assets/village/village-hero-albedo.png';
  const material = new THREE.MeshStandardMaterial({ map: texture }); material.name = 'village-wall';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material); mesh.name = 'inn-wall'; root.add(mesh);

  const beforeAnisotropy = texture.anisotropy;
  const audit = auditTextureBudget(root, { softBytes: 1, maxDimension: 2048 });
  assert.equal(audit.count, 1);
  assert.equal(audit.gate, 'review');
  assert.equal(audit.oversized, 1);
  assert.equal(audit.offenders[0].label, 'village-hero-albedo.png');
  assert.equal(audit.offenders[0].usages[0].node, 'inn-wall');
  assert.equal(audit.offenders[0].usages[0].material, 'village-wall');
  assert.equal(audit.offenders[0].usages[0].slot, 'map');
  assert.equal(texture.anisotropy, beforeAnisotropy);
});

test('compressed texture residency uses actual mip payload when available', () => {
  const texture = new THREE.CompressedTexture();
  texture.image = { width: 4096, height: 4096 };
  texture.name = 'terrain.ktx2';
  texture.mipmaps = [{ data: new Uint8Array(1024) }, { data: new Uint8Array(256) }];
  assert.equal(estimateTextureBytes(texture), 1280);
});

test('static batch audit is non-mutating and excludes stateful content', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  repeatedMeshes(root, 5, geometry, material, { statefulAt: 4 });
  const childrenBefore = [...root.children];
  const audit = auditStaticBatchOpportunities(root, { minInstances: 4 });
  assert.equal(audit.candidateGroups, 1);
  assert.equal(audit.projectedInstances, 4);
  assert.equal(audit.projectedSavedDrawCalls, 3);
  assert.deepEqual(root.children, childrenBefore);
  assert.equal(root.children.some(node => node.isInstancedMesh), false);
});

test('static batch audit keeps transform parents and render layers isolated', () => {
  const root = new THREE.Group(), left = new THREE.Group(), right = new THREE.Group();
  root.add(left, right);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  repeatedMeshes(left, 2, geometry, material);
  repeatedMeshes(right, 2, geometry, material);
  const report = auditStaticBatchOpportunities(root, { minInstances: 4 });
  assert.equal(report.candidateGroups, 0);

  const sameParent = new THREE.Group(); root.add(sameParent);
  repeatedMeshes(sameParent, 4, geometry, material);
  sameParent.children[2].layers.mask = 2;
  sameParent.children[3].layers.mask = 2;
  const layered = auditStaticBatchOpportunities(root, { minInstances: 4 });
  assert.equal(layered.candidateGroups, 0);
});

test('scene budget reports material/draw-call pressure and conservative savings', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(); material.name = 'crate';
  repeatedMeshes(root, 5, geometry, material, { statefulAt: 4 });
  const report = auditSceneBudget(root, { softDrawCalls: 4, minInstances: 4 });
  assert.equal(report.renderables, 5);
  assert.equal(report.estimatedDrawCalls, 5);
  assert.equal(report.projectedDrawCalls, 2);
  assert.equal(report.uniqueMaterials, 1);
  assert.equal(report.gate, 'review');
  assert.equal(report.staticBatch.projectedSavedDrawCalls, 3);
});

test('scene budget counts each geometry group as a draw call even when material is reused', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0,0,0, 1,0,0, 0,1,0,
    1,0,0, 1,1,0, 0,1,0,
  ], 3));
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 0);
  const material = new THREE.MeshBasicMaterial();
  root.add(new THREE.Mesh(geometry, [material]));
  const report = auditSceneBudget(root);
  assert.equal(report.estimatedDrawCalls, 2);
});

test('rendering budget snapshot combines scene and texture diagnostics', () => {
  const root = new THREE.Group();
  const texture = new THREE.Texture(); texture.image = { width: 512, height: 512 }; texture.name = 'shared.png';
  const material = new THREE.MeshStandardMaterial({ map: texture });
  repeatedMeshes(root, 4, new THREE.BoxGeometry(), material);
  const snapshot = createRenderingBudgetSnapshot(root, { scene: { minInstances: 4 } });
  assert.equal(snapshot.texture.count, 1);
  assert.equal(snapshot.scene.staticBatch.projectedSavedDrawCalls, 3);
});
