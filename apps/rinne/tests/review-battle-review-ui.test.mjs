import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('battle review uses protagonist and removes opaque manual actions',async()=>{
  const [html,stage,controller]=await Promise.all([read('review-battle.html'),read('src/review-battle-stage.js'),read('src/review-battle.js')]);
  assert.match(stage,/createProtagonistCharacterPool/);
  assert.match(stage,/RINNE_PROTAGONIST_MODEL_ID/);
  assert.doesNotMatch(html,/id="battle-restart"/);
  assert.doesNotMatch(html,/id="battle-inspire"/);
  assert.match(html,/data-inspiration-mode="boost"/);
  assert.match(controller,/data-inspiration-mode/);
  assert.match(controller,/inspirationMode='boost'/);
});
