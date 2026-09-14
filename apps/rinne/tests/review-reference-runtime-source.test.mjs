import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const runtime=readFileSync(new URL('../../../packages/rendering/src/master-character-reference.js',import.meta.url),'utf8');
const wardrobe=readFileSync(new URL('../../../packages/rendering/src/master-character-wardrobe.js',import.meta.url),'utf8');
test('reference runtime keeps dedicated geometry attached to humanoid bones',()=>{
  assert.match(runtime,/reference-character:/);
  assert.match(runtime,/addHumanoid/);
  assert.match(runtime,/addWardrobe/);
  assert.match(runtime,/addProps/);
  assert.match(wardrobe,/hairGeometry/);
  assert.match(wardrobe,/outfitGeometry/);
  assert.match(wardrobe,/gearGeometry/);
});
