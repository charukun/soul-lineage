import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { MOTION_LIBRARY_MODELS, motionLibraryModel, motionLibraryModelURL } from '../src/review/motion-library-models.js';

const adapter=readFileSync(new URL('../src/review/review-adapter.js',import.meta.url),'utf8');
const renderingPackage=JSON.parse(readFileSync(new URL('../../../packages/rendering/package.json',import.meta.url),'utf8'));
const retiredFiles=[
  new URL('../src/review/reference-character-models.js',import.meta.url),
  new URL('../../../packages/rendering/src/master-character-reference.js',import.meta.url),
  new URL('../../../packages/rendering/src/master-character-wardrobe.js',import.meta.url),
  new URL('../../../packages/rendering/src/arcanist-atlas-study.js',import.meta.url)
];

test('Visual Review Lab keeps retired procedural character bodies out of the public runtime',()=>{
  for(const file of retiredFiles)assert.equal(existsSync(file),false,`${file.pathname} must stay retired`);
  assert.doesNotMatch(adapter,/REVIEW_REFERENCE_MODELS|reference-character-models|attachReferenceCharacterController|attachArcanistAtlasStudy/);
  assert.match(adapter,/\.\.\.baseReviewPresets/);
  assert.equal(renderingPackage.exports['./master-character-reference'],undefined);
  assert.equal(renderingPackage.exports['./arcanist-atlas-study'],undefined);
});

test('Visual Review Lab keeps the five real Motion Library characters', () => {
  assert.equal(MOTION_LIBRARY_MODELS.length, 5);
  assert.deepEqual(MOTION_LIBRARY_MODELS.map(row => row.label), ['Knight','Barbarian','Mage','Rogue','Rogue Hooded']);
  for (const row of MOTION_LIBRARY_MODELS) {
    assert.equal(motionLibraryModel(row.presetId), row);
    assert.equal(motionLibraryModel(row.id), row);
    assert.ok(motionLibraryModelURL(row).endsWith('/' + row.file));
  }
  assert.ok(adapter.includes('...MOTION_LIBRARY_PRESETS'));
  assert.ok(adapter.includes('loadMotionLibraryPreset'));
  assert.ok(adapter.includes('motionLibraryModel(args?.presetId)'));
  assert.ok(adapter.includes('Motion Library / 埋め込みモーション'));
});
