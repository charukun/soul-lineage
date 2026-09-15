import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARCANIST_ATLAS_STUDY_ID, ARCANIST_ATLAS_STUDY_STAGE } from '@soul/rendering/arcanist-atlas-study';

const adapter=readFileSync(new URL('../src/review/review-adapter.js',import.meta.url),'utf8');

test('explicit Arcanist Atlas comparison remains a BLOCKOUT and does not replace the real model catalog',()=>{
  assert.equal(ARCANIST_ATLAS_STUDY_ID,'arcanist.atlas-study.v1');
  assert.equal(ARCANIST_ATLAS_STUDY_STAGE,'BLOCKOUT');
  assert.match(adapter,/Arcanist Atlas Study \/ BLOCKOUT/);
  assert.match(adapter,/source:'explicit-review-blockout'/);
  assert.match(adapter,/presetId===ARCANIST_ATLAS_STUDY_ID/);
  assert.match(adapter,/presetId:'model\.SHINO'/);
  assert.doesNotMatch(adapter,/productionReady:true/);
});
