import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('百年転生 and sibling apps can share the canonical boot crest',async()=>{
  const source=await readFile(new URL('../src/brand-start.js',import.meta.url),'utf8');
  assert.match(source,/applyBootBrand/);
  assert.match(source,/rinneCrestUrl/);
  assert.match(source,/wordmark:'百年転生'/);
});
