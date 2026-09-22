import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewLoadController} from '../packages/shared-ui/src/review/load-controller.js';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('review load controller rejects stale generations',()=>{
  const loads=createReviewLoadController();
  const first=loads.begin(),second=loads.begin();
  assert.equal(loads.isCurrent(first),false);
  assert.equal(loads.isCurrent(second),true);
  loads.invalidate();
  assert.equal(loads.isCurrent(second),false);
});

test('character, equipment, and object reviews share stale-load lifecycle',async()=>{
  const sources=await Promise.all([
    read('apps/character-studio/src/review/character/runtime.js'),
    read('apps/rinne/src/review/equipment/entrypoint.js'),
    read('apps/rinne/src/review/objects/entrypoint.js'),
  ]);
  for(const source of sources){
    assert.match(source,/@soul\/shared-ui\/review-load-controller/);
    assert.match(source,/createReviewLoadController\(\)/);
    assert.doesNotMatch(source,/loadSequence/);
  }
  assert.match(sources[0],/setReviewStatus/);
});
