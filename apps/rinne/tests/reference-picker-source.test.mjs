import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const adapter=readFileSync(new URL('../src/review/review-adapter.js',import.meta.url),'utf8');
const ux=readFileSync(new URL('../src/review/review-ux.js',import.meta.url),'utf8');
test('reference picker routes selected rows through the runtime renderer',()=>{
  assert.match(adapter,/REVIEW_REFERENCE_MODELS/);
  assert.match(adapter,/attachReferenceCharacterController/);
  assert.match(adapter,/controller\.setIdentity\(reference\)/);
  assert.match(ux,/row\.portraitPath/);
  assert.match(ux,/preset\.dispatchEvent\(new Event\('change'/);
});
