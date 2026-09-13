import test from 'node:test';
import assert from 'node:assert/strict';
import { hairGeometry, accessoryGeometry } from '../src/master-character-wardrobe.js';

test('reference-derived bun hair and ribbon accessory produce real review geometry', () => {
  const geometries = [
    hairGeometry('bun', 'swept', 'tied'),
    hairGeometry('bun', 'open', 'layered'),
    accessoryGeometry('ribbon')
  ];
  for (const geometry of geometries) {
    assert.ok(geometry.getAttribute('position')?.count > 0);
    geometry.computeBoundingSphere();
    assert.ok(geometry.boundingSphere?.radius > 0);
    geometry.dispose();
  }
});
