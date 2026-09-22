import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { progressMiniModel } from '../ops-board/public/progress-mini.js';

test('shared mini progress model treats ACTIVE and ITERATION steps with the same state semantics',()=>{
  const model=progressMiniModel([
    {id:'implementation',label:'実装',state:'done'},
    {id:'validation',label:'検証',state:'running'},
    {id:'browser',label:'Browser',state:'waiting'},
    {id:'merge',label:'merge',state:'waiting'},
    {id:'publish',label:'DEV',state:'waiting'},
  ]);
  assert.equal(model.total,5);
  assert.equal(model.complete,1);
  assert.equal(model.current.id,'validation');
  assert.equal(model.status,'running');
  assert.equal(model.points[0].score,1);
  assert.equal(model.points[1].tone,'running');
  assert.equal(model.current.id,'validation');
});

test('problem state takes visual priority and skipped steps count as completed positions',()=>{
  const model=progressMiniModel([
    {id:'observation',label:'観測',state:'done'},
    {id:'implementation',label:'実装',state:'skipped'},
    {id:'astraValidation',label:'Astra',state:'problem'},
    {id:'afterObservation',label:'After',state:'pending'},
  ]);
  assert.equal(model.complete,2);
  assert.equal(model.current.id,'astraValidation');
  assert.equal(model.status,'problem');
  assert.equal(model.points[1].tone,'skipped');
});

test('mini progress renderer stays DOM-safe and uses one shared SVG implementation',()=>{
  const source=readFileSync(new URL('../ops-board/public/progress-mini.js',import.meta.url),'utf8');
  assert.match(source,/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg'/);
  assert.match(source,/rapid-progress-line/);
  assert.match(source,/rapid-progress-labels/);
  assert.match(source,/--rapid-progress-count/);
  assert.match(source,/model\.current\?\.id===point\.id\?' current'/);
  assert.match(source,/現在 /);
  assert.doesNotMatch(source,/innerHTML|api\.github\.com/);
});
