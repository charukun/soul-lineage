import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Bone } from 'three';
import { wardrobeCacheStats } from '@soul/rendering/master-character-wardrobe';
import { attachGoldenBaseWardrobe } from '../src/golden-base-wardrobe.js';

test('Golden Base reuses the modular outfit geometry and releases each lease', () => {
  const root = new Group();
  const spine = new Bone(); spine.name = 'spine'; root.add(spine);
  const before = wardrobeCacheStats().leases;
  const wardrobe = attachGoldenBaseWardrobe(root);
  assert.equal(wardrobe.outfit, 'uniform');
  assert.equal(root.getObjectByName('golden-base-wardrobe').children.length, 0);
  for (const outfit of ['tunic', 'mantle', 'apron']) {
    wardrobe.setOutfit(outfit);
    assert.equal(wardrobe.outfit, outfit);
    assert.equal(root.getObjectByName('golden-base-wardrobe').children.length, 2);
    assert.equal(wardrobeCacheStats().leases, before + 2);
  }
  wardrobe.setOutfit('uniform');
  assert.equal(wardrobeCacheStats().leases, before);
  assert.equal(root.getObjectByName('golden-base-wardrobe').children.length, 0);
  assert.throws(() => wardrobe.setOutfit('invalid'), /Unsupported/);
  wardrobe.dispose();
  assert.equal(spine.children.length, 0);
  assert.equal(wardrobeCacheStats().leases, before);
  assert.throws(() => wardrobe.setOutfit('tunic'), /disposed/);
});
