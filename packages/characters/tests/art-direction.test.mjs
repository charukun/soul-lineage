import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHINO_ART_PROFILE_ID,
  STYLIZED_ART_PROFILES,
  STYLIZED_ART_STYLE_ID,
  stylizedArtProfile,
  stylizedProfileForRole,
  validateStylizedArtProfile,
} from '../src/art-direction.js';

test('visual hierarchy keeps named characters richer than population and distant assets', () => {
  assert.equal(SHINO_ART_PROFILE_ID, 'hero');
  assert.equal(stylizedArtProfile('hero').styleId, STYLIZED_ART_STYLE_ID);
  assert.ok(STYLIZED_ART_PROFILES.hero.geometry.radialSegmentsMax > STYLIZED_ART_PROFILES.npc.geometry.radialSegmentsMax);
  assert.ok(STYLIZED_ART_PROFILES.npc.geometry.radialSegmentsMax >= STYLIZED_ART_PROFILES.enemy.geometry.radialSegmentsMax);
  assert.ok(STYLIZED_ART_PROFILES.enemy.geometry.radialSegmentsMax > STYLIZED_ART_PROFILES.distant.geometry.radialSegmentsMax);
  assert.equal(STYLIZED_ART_PROFILES.hero.surface.flatShading, false);
  assert.equal(STYLIZED_ART_PROFILES.enemy.surface.flatShading, true);
});

test('role selection is deterministic and portable', () => {
  assert.equal(stylizedProfileForRole({ named: true }).id, 'hero');
  assert.equal(stylizedProfileForRole({ enemy: true }).id, 'enemy');
  assert.equal(stylizedProfileForRole({ environment: true }).id, 'environment');
  assert.equal(stylizedProfileForRole({ prop: true }).id, 'prop');
  assert.equal(stylizedProfileForRole({ distant: true }).id, 'distant');
  assert.equal(stylizedProfileForRole().id, 'npc');
  assert.throws(() => stylizedArtProfile('ultra-real'), /Unknown stylized art profile/);
});

test('profiles are immutable and self-validating', () => {
  for (const value of Object.values(STYLIZED_ART_PROFILES)) {
    assert.equal(validateStylizedArtProfile(value), value);
    assert.equal(Object.isFrozen(value), true);
    assert.equal(Object.isFrozen(value.geometry), true);
    assert.equal(Object.isFrozen(value.surface), true);
  }
});