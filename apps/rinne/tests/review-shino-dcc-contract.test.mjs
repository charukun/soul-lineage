import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adapter=readFileSync(new URL('../src/review/review-adapter.js',import.meta.url),'utf8');
const ux=readFileSync(new URL('../src/review/review-ux.js',import.meta.url),'utf8');

test('Visual Review Lab loads Shino Reference v2 from exact-hash DCC bytes',()=>{
  assert.match(adapter,/id:'shino\.reference\.v2'/);
  assert.match(adapter,/productionStage:'PRIMARY'/);
  assert.match(adapter,/modelingMode:'dcc-blender'/);
  assert.match(adapter,/SHINO_REFERENCE_V2\.asset\.json/);
  assert.match(adapter,/SHINO_REFERENCE_V2\.vrm/);
  assert.match(adapter,/crypto\.subtle\.digest\('SHA-256'/);
  assert.match(adapter,/DCC SHA-256 mismatch/);
  assert.match(adapter,/GLTFLoader/);
  assert.doesNotMatch(adapter,/args\?\.presetId===DCC_SHINO\.id[^]*attachReferenceCharacterController/);
});

test('DCC Shino picker uses generated review evidence as portrait',()=>{
  assert.match(adapter,/portraitPath:`\$\{DCC_REVIEW_ROOT\}front\.png`/);
  assert.match(ux,/row\.portraitPath/);
});
