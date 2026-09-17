import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const picker=read('../src/review-slot-picker.js');
const auto=read('../src/review-slot-auto.js');
const css=read('../src/review-slot-picker.css');

test('Visual Review selector uses one five-column slot-grid contract',()=>{
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(picker,/export function mountReviewSelect/);
  assert.match(picker,/export function mountReviewGroup/);
  assert.match(picker,/dispatchEvent\(new Event\('change'/);
  assert.match(picker,/source\.click\(\)/);
  assert.match(picker,/event\.key==='Escape'/);
});

test('review surfaces are mapped to the shared slot picker',()=>{
  for(const marker of ['character-model-options','slot-tabs','part-options','qa-motion','qa-speed','qa-cameras','model-options','slot-main','slot-off','slot-back','preset-grid','fx-speed','fx-tier','battle-hero-model','skin-switch']){
    assert.ok(auto.includes(marker),`missing slot mapping: ${marker}`);
  }
  assert.match(auto,/data-camera="front"/);
});

test('all Visual Review entry pages load slot auto wiring',()=>{
  for(const page of ['../characters.html','../review-assets.html','../review-effects.html','../review-battle.html']){
    assert.match(read(page),/review-slot-auto\.js/,`${page} must load review-slot-auto.js`);
  }
});

test('battle review keeps the self-player-only contract from the shared phase-panel change',()=>{
  const battle=read('../review-battle.html');
  assert.match(battle,/id="battle-hero-model"/);
  assert.doesNotMatch(battle,/id="battle-enemy-model"/);
  assert.doesNotMatch(battle,/id="battle-loop"/);
  assert.doesNotMatch(battle,/id="battle-camera"/);
});
