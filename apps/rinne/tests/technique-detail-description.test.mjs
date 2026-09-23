import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(here,'../src/heart-technique-body-ui.js'),'utf8');

test('selected technique detail exposes its canonical explanation',()=>{
  assert.match(source,/skillDefinition\(selection\)/);
  assert.match(source,/definition\?\.mechanic/);
  assert.match(source,/definition\?\.steps/);
  assert.match(source,/definition\?\.tradeoff/);
  assert.match(source,/動作:/);
  assert.match(source,/注意:/);
  assert.match(source,/summary:explanation\|\|row\.summary/);
});
