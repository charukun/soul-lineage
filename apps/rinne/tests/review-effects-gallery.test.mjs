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
  assert.match(html,/class="stage-selection-slot"/);
  assert.match(html,/class="stage-selection-kicker">選択中/);
  assert.match(html,/class="catalog-kicker">候補一覧/);
  assert.match(html,/id="fx-selected-label"/);
  assert.match(html,/id="fx-selected-meta"/);
  assert.match(js,/q\('fx-selected-label'\)\.textContent=entry\.label/);
  assert.match(js,/q\('fx-selected-meta'\)\.textContent=effectLabel\(entry\.id\)/);
  assert.doesNotMatch(html,/class="fx-selection-slot"/);
  assert.doesNotMatch(html,/class="catalog-head"/);
  assert.match(slotAuto,/if\(!byId\('fx-stage'\)\|\|byId\('fx-catalog'\)\)return/);
});

test('VFX stage uses readable humanoid scale and effect-intent guides',()=>{
  assert.match(js,/function createReviewMannequin/);
  assert.match(js,/new THREE\.BoxGeometry\(\.5,\.72,\.3\)/);
  assert.match(js,/new THREE\.IcosahedronGeometry\(\.23,2\)/);
  assert.match(js,/function createPointGuide/);
  assert.match(js,/function createImpactGuide/);
  assert.match(js,/function createAreaGuide/);
  assert.match(js,/const REVIEW_CONTEXTS=Object\.freeze/);
  assert.match(js,/secondaryB\.visible=context\.secondary/);
  assert.match(js,/areaGuide\.visible=context\.area>0/);
  assert.doesNotMatch(js,/function marker\(/);
  assert.doesNotMatch(js,/CapsuleGeometry/);
  assert.match(html,/ATTACKER/);
  assert.match(html,/IMPACT \/ AREA/);
  assert.match(html,/PRIMARY TARGET/);
});

test('VFX discovery tools stay available but hide while the catalog is trivially small',()=>{
  assert.match(html,/id="fx-discovery-tools"/);
  assert.match(js,/const discoveryNeeded=REVIEW_CATALOG\.length>10/);
  assert.match(js,/q\('fx-discovery-tools'\)\.hidden=!discoveryNeeded/);
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
  assert.match(html,/<input id="fx-loop" type="checkbox" checked autocomplete="off">/);
  assert.match(js,/const loopToggle=q\('fx-loop'\)/);
  assert.match(js,/const ensureLoopDefaultOn=\(\)=>\{loopToggle\.checked=true;\}/);
  assert.match(js,/window\.addEventListener\('pageshow',ensureLoopDefaultOn\)/);
  assert.match(js,/if\(loopToggle\.checked&&now-lastTrigger>/);
  assert.match(js,/createAuthoredEffectPlayer/);
  assert.match(js,/createEffekseerBackend/);
  assert.match(js,/player\.present\(eventsFor\(preset\)/);
});

test('effect list stays visible as a five-column grid on all review widths',()=>{
  assert.match(css,/\.fx-catalog\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css,/@media\(max-width:900px\)[^}]*\.fx-catalog\{[^}]*grid-template-columns/);
  assert.doesNotMatch(css,/@media\(max-width:640px\)[^}]*\.fx-catalog\{[^}]*grid-template-columns/);
  assert.match(css,/\.stage-selection-slot\{[^}]*box-shadow:inset 3px 0/);
  assert.match(css,/\.catalog-kicker\{/);
  assert.match(css,/\.fx-option\{[^}]*background:#101614/);
  assert.match(css,/\.fx-option\[aria-pressed="true"\]\{[^}]*inset 0 -2px/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.match(css,/\.catalog-shell\{[^}]*overflow:hidden/);
});
