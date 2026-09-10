import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadVillage, validateWorld } from '../src/index.js';
test('world template copies are isolated between apps', () => {
  const one = loadVillage(), two = loadVillage(); one.entities[0].position[0] = 9;
  assert.equal(two.entities[0].position[0], 0);
});
test('invalid schema, unresolved assets and duplicate entities are rejected', () => {
  const world = loadVillage(); world.schemaVersion = 99; assert.throws(() => validateWorld(world));
  world.schemaVersion = 1; world.entities[0].assetId = 'missing'; assert.throws(() => validateWorld(world));
  const duplicate = loadVillage(); duplicate.entities.push(duplicate.entities[0]); assert.throws(() => validateWorld(duplicate));
});
