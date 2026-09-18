import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/stylized-visual-target.js', import.meta.url), 'utf8');

test('village stylized target keeps gameplay objects while applying static LOD and visual-only vegetation density', () => {
  assert.match(source, /installStylizedGeometryLOD/);
  assert.match(source, /stylizedDensityForDistance/);
  assert.match(source, /forestMeshes/);
  assert.match(source, /flowerMeshes/);
  assert.match(source, /stylizedDensityBase/);
  assert.match(source, /cloneMaterials: true/);
  assert.doesNotMatch(source, /world\.objects.*visible\s*=\s*false/);
});
