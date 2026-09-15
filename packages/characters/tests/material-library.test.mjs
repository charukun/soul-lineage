import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STYLIZED_MATERIAL_TOKENS,
  STYLIZED_PALETTE,
  defaultMaterialTokenForProfile,
  stylizedMaterialToken,
} from '../src/material-library.js';

test('shared material library exposes portable surface tokens and palette tokens', () => {
  assert.equal(defaultMaterialTokenForProfile('hero'), 'surface.hero');
  assert.equal(defaultMaterialTokenForProfile('environment'), 'surface.environment');
  assert.equal(stylizedMaterialToken('metal.iron').baseColor, STYLIZED_PALETTE.iron01);
  assert.equal(stylizedMaterialToken('surface.hero').preserveBaseColor, true);
  assert.equal(stylizedMaterialToken('wood.oak.weathered').preserveBaseColor, false);
});

test('shared material tokens stay frozen and within PBR ranges', () => {
  for (const row of Object.values(STYLIZED_MATERIAL_TOKENS)) {
    assert.equal(Object.isFrozen(row), true);
    assert.ok(row.roughness >= 0 && row.roughness <= 1);
    assert.ok(row.metalness >= 0 && row.metalness <= 1);
  }
  assert.throws(() => stylizedMaterialToken('unknown'), /Unknown stylized material token/);
});
