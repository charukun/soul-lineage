import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('PULSE iterations is a dedicated one-card-per-iteration page with a duration line graph',()=>{
  const html=text('ops-board/public/iterations.html');
  const js=text('ops-board/public/iterations.js');
  const css=text('ops-board/public/iterations.css');
  assert.match(html,/<title>PULSE Iterations<\/title>/);
  assert.match(html,/id="iteration-list"/);
  assert.match(html,/id="iteration-game-filter"/);
  assert.match(html,/id="iteration-status-filter"/);
  assert.match(js,/state\.autonomousIterations/);
  assert.match(js,/iteration\.runKey/);
  assert.match(js,/iteration\.iteration/);
  assert.match(js,/iteration\.improvementSummary/);
  assert.match(js,/iteration\.rootCauses/);
  assert.match(js,/iteration\.changedPaths/);
  assert.match(js,/createElementNS\('http:\/\/www\.w3\.org\/2000\/svg'/);
  assert.match(js,/STEP DURATION/);
  assert.match(js,/stepDuration/);
  assert.match(js,/step\.state==='running'/);
  assert.match(css,/\.iteration-chart/);
  assert.match(css,/min-width:720px/);
  assert.doesNotMatch(js,/api\.github\.com|innerHTML/);
});

test('PULSE top links autonomous summary to the dedicated iterations page',()=>{
  const html=text('ops-board/public/index.html');
  assert.match(html,/href="\.\/iterations\.html">イテレーション詳細/);
});
