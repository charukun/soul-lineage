import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);

test('effects review is catalog-led and keeps primitive capsules out of the primary stage',async()=>{
  const [html,js]=await Promise.all([
    readFile(new URL('review-effects.html',root),'utf8'),
    readFile(new URL('src/review-effects.js',root),'utf8'),
  ]);
  for(const id of ['fx-catalog','fx-categories','fx-scenarios','fx-replay','fx-candidate','fx-loop','fx-speed','fx-tier','fx-reduced'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/createKaykitCharacterPools/);
  assert.match(js,/effectDefinitions:REVIEW_AUTHORED_EFFECTS/);
  assert.match(js,/runtime-models/);
  assert.doesNotMatch(js,/CapsuleGeometry/);
});
