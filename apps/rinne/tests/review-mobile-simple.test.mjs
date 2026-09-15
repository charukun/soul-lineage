import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controls=readFileSync(new URL('../src/review/review-controls.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/review/review-mobile-simple.css',import.meta.url),'utf8');
const ux=readFileSync(new URL('../src/review/review-ux.js',import.meta.url),'utf8');

test('phone review keeps primary controls focused and hides secondary density',()=>{
  assert.match(controls,/button\('動作'/);
  assert.match(controls,/make\('summary','その他'\)/);
  assert.match(controls,/make\('summary','再生・視点・詳細'\)/);
  assert.match(controls,/advancedDetails\.prepend\(equipment\)/);
  assert.match(css,/\.review-controls-dock \.weapon-quick\{display:none!important\}/);
  assert.match(css,/\.review-controls-dock \.notebook-scroll\{overflow:hidden!important/);
  assert.match(css,/\.review-drawer-scroll \.review-controls-dock \.notebook-scroll\{overflow:auto!important/);
});

test('review drawer closes after selecting a model or motion target',()=>{
  assert.match(controls,/target\.classList\.contains\('review-select'\)\|\|target\.id==='preset'/);
  assert.match(controls,/queueMicrotask\(\(\)=>setOpen\(false\)\)/);
  assert.match(controls,/\[data-play-select\],\.sequence-review-action/);
});

test('Visual Review Lab exposes one-tap Motion Library navigation',()=>{
  assert.match(ux,/href='\.\/motion-library\.html'/);
  assert.match(ux,/review-motion-link/);
  assert.match(ux,/Motions/);
});
