import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { progressMiniModel, progressStepDurationMs, progressDurationLabel } from '../ops-board/public/progress-mini.js';

test('shared mini graph is a left-to-right duration timeline',()=>{
  const now=Date.parse('2026-09-22T02:00:20Z');
  const model=progressMiniModel([
    {id:'implementation',label:'実装',state:'done',durationMs:84000},
    {id:'validation',label:'検証',state:'running',startedAt:'2026-09-22T02:00:08Z'},
    {id:'browser',label:'Browser',state:'waiting'},
    {id:'merge',label:'merge',state:'waiting'},
    {id:'publish',label:'DEV',state:'waiting'},
  ],now);
  assert.equal(model.total,5);
  assert.equal(model.measured.length,2);
  assert.equal(model.current.id,'validation');
  assert.equal(model.points[0].durationLabel,'84s');
  assert.equal(model.points[1].durationLabel,'12s');
  assert.equal(model.points[2].measured,false);
  assert.equal(model.status,'running');
});

test('duration uses explicit telemetry first, then completed timestamps, then live running elapsed',()=>{
  const now=Date.parse('2026-09-22T02:01:00Z');
  assert.equal(progressStepDurationMs({durationMs:1500,startedAt:'2026-09-22T01:00:00Z'},now),1500);
  assert.equal(progressStepDurationMs({startedAt:'2026-09-22T02:00:10Z',completedAt:'2026-09-22T02:00:25Z'},now),15000);
  assert.equal(progressStepDurationMs({state:'running',startedAt:'2026-09-22T02:00:40Z'},now),20000);
  assert.equal(progressStepDurationMs({state:'waiting'},now),null);
  assert.equal(progressDurationLabel(2300),'2.3s');
  assert.equal(progressDurationLabel(215120),'215s');
});

test('problem state keeps priority without inventing timing for pending work',()=>{
  const model=progressMiniModel([
    {id:'observation',label:'観測',state:'done',durationMs:4200},
    {id:'implementation',label:'実装',state:'skipped'},
    {id:'astraValidation',label:'Astra',state:'problem',durationMs:88000},
    {id:'afterObservation',label:'After',state:'pending'},
  ]);
  assert.equal(model.complete,2);
  assert.equal(model.current.id,'astraValidation');
  assert.equal(model.status,'problem');
  assert.equal(model.measured.length,2);
  assert.equal(model.points[3].durationLabel,'');
});

test('duration renderer stays DOM-safe and plots only measured points into the line',()=>{
  const source=readFileSync(new URL('../ops-board/public/progress-mini.js',import.meta.url),'utf8');
  assert.match(source,/progressStepDurationMs/);
  assert.match(source,/durationLabel/);
  assert.match(source,/measuredCoords=coords\.filter/);
  assert.match(source,/rapid-progress-guide/);
  assert.match(source,/計測 /);
  assert.doesNotMatch(source,/SCORE|innerHTML|api\.github\.com/);
});
