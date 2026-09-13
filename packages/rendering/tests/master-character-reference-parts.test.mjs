import test from 'node:test';
import assert from 'node:assert/strict';
import { hairGeometry, accessoryGeometry } from '../src/master-character-wardrobe.js';
import {
  REFERENCE_ARCHETYPE_PARTS, REFERENCE_DETAIL_IDS, REFERENCE_DETAIL_MATERIALS,
  referenceArchetypePartSpecs, referenceDetailGeometry
} from '../src/reference-archetype-parts.js';
import { CHARACTER_REFERENCE_ARCHETYPES } from '@soul/characters';

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

test('every NPC reference archetype has authored reference-only 3D detail parts', () => {
  const ids = Object.keys(CHARACTER_REFERENCE_ARCHETYPES);
  assert.equal(ids.length, 10);
  assert.deepEqual(Object.keys(REFERENCE_ARCHETYPE_PARTS).sort(), ids.sort());

  for (const id of ids) {
    const specs = referenceArchetypePartSpecs(id);
    assert.ok(specs.length >= 2, `${id} needs authored reference geometry`);
    assert.ok(CHARACTER_REFERENCE_ARCHETYPES[id].coverage.implementedModularParts.some(item => item.startsWith('reference-3d:')));
    for (const spec of specs) {
      assert.ok(REFERENCE_DETAIL_IDS.includes(spec.id), `${id}: unknown detail ${spec.id}`);
      assert.ok(REFERENCE_DETAIL_MATERIALS.includes(spec.material), `${id}: unknown material ${spec.material}`);
      assert.match(spec.mount, /^(spine|head|(left|right)(UpperArm|LowerArm|Hand|UpperLeg|LowerLeg|Foot))$/);
      if (spec.orientTo) assert.match(spec.orientTo, /^(left|right)(LowerArm|Hand|LowerLeg|Foot)$/);
    }
  }
});

test('all reference detail factories produce finite non-empty geometry', () => {
  assert.ok(REFERENCE_DETAIL_IDS.length >= 20);
  for (const id of REFERENCE_DETAIL_IDS) {
    const geometry = referenceDetailGeometry(id);
    const position = geometry.getAttribute('position');
    assert.ok(position?.count > 0, `${id} has no positions`);
    geometry.computeBoundingSphere();
    assert.ok(Number.isFinite(geometry.boundingSphere?.radius) && geometry.boundingSphere.radius > 0, `${id} has invalid bounds`);
    geometry.dispose();
  }
});
