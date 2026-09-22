import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMuraTerrain} from '../src/mura/terrain.js';

test('mounting shared terrain preserves host prop lookup for subsequent buildings and landmarks', () => {
  const material = new THREE.MeshStandardMaterial();
  const prop = new THREE.Group();
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  const host = {scene: new THREE.Scene(), outside: new THREE.Group(), getProp() { return prop; }};
  const originalLookup = host.getProp;
  const terrain = createMuraTerrain({THREE, scene: host.scene, outside: host.outside,
    getProp: kind => host.getProp(kind), mat: () => material,
    createCanvas: () => ({width: 0, height: 0})});
  Object.assign(host, terrain);
  assert.equal(host.getProp, originalLookup);
  assert.equal(host.getProp('bench'), prop);
  assert.ok(host.waterMat.isShaderMaterial);
  assert.ok(host.forestMeshes.length > 0);
  assert.ok(host.outside.children.includes(host.ocean));
  assert.ok(host.scene.children.includes(host.hintGroup));
});
