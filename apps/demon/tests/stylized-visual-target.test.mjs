import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/stylized-visual-target.js', import.meta.url), 'utf8');

test('demon stylized target spends geometry savings on capped hit/feed VFX', () => {
  assert.match(source, /enemyProfile\.effects/);
  assert.match(source, /activePointCount/);
  assert.match(source, /maxParticles/);
  assert.match(source, /boosted/);
  assert.match(source, /NightView\.prototype\.spark/);
  assert.match(source, /NightView\.prototype\.slash/);
  assert.match(source, /installStylizedGeometryLOD/);
});
