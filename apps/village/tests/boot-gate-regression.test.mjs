import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Village boots directly without the unrelated shared brand gate',async()=>{
  const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(index,/src\/main\.js/);
  assert.doesNotMatch(index,/src\/brand-start\.js/);
  assert.doesNotMatch(index,/PARALYZE AREA/);
});
