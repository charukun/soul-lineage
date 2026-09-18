import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const html=read('../review-effects.html');
const js=read('../src/review-effects.js');
const css=read('../src/review-effects.css');
const slotAuto=read('../src/review-slot-auto.js');

test('VFX review is catalog-first while keeping one real preview stage',()=>{
  assert.match(html,/id="fx-catalog"/);
  assert.match(html,/id="fx-search"/);
  assert.match(html,/data-filter="all"/);
  assert.match(html,/data-filter="attack"/);
  assert.match(html,/data-filter="impact"/);
  assert.match(html,/data-filter="finisher"/);
  assert.match(html,/data-filter="combo"/);
  assert.equal((html.match(/<canvas\b/g)||[]).length,1);
  assert.equal((js.match(/new THREE\.WebGLRenderer/g)||[]).length,1);
  assert.match(js,/const REVIEW_CATALOG=Object\.freeze/);
  assert.match(js,/replaceChildren\(\.\.\.visible\.map\(cardFor\)\)/);
  assert.match(js,/button\.addEventListener\('click',\(\)=>trigger\(entry\.id\)\)/);
  assert.match(slotAuto,/if\(!byId\('fx-stage'\)\|\|byId\('fx-catalog'\)\)return/);
});

test('VFX catalog supports fast search and category filtering without acquisition UI',()=>{
  assert.match(js,/fx-search/);
  assert.match(js,/activeFilter/);
  assert.match(js,/haystack\.includes\(needle\)/);
  assert.match(js,/CATEGORY_LABELS/);
  assert.doesNotMatch(html,/import|download|remote|URL/i);
  assert.doesNotMatch(js,/fetch\(/);
});

test('existing playback review controls stay available as secondary tools',()=>{
  for(const id of ['fx-speed','fx-tier','fx-loop','fx-reduced','fx-pause','fx-clear','fx-camera','fx-metrics']){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  assert.match(html,/<details class="controls">/);
  assert.match(js,/createAuthoredEffectPlayer/);
  assert.match(js,/createEffekseerBackend/);
  assert.match(js,/player\.present\(eventsFor\(preset\)/);
});

test('catalog remains dense on narrow review devices',()=>{
  assert.match(css,/\.fx-catalog\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.match(css,/\.catalog-shell\{[^}]*overflow:hidden/);
});
