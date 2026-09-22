import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RINNE_UI_VERSION} from '../src/ui-version.js';

const gameplay=readFileSync(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
const sharedFour=readFileSync(new URL('../../../packages/shared-ui/src/rinne-primary-four.js',import.meta.url),'utf8');
const sharedFourCss=readFileSync(new URL('../../../packages/shared-ui/src/rinne-primary-four.css',import.meta.url),'utf8');
const sharedMenu=readFileSync(new URL('../../../packages/shared-ui/src/rinne-loadout-menu.js',import.meta.url),'utf8');
const family=readFileSync(new URL('../src/family-origin-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/rinne-world-ui.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('RINNE 5.2 protects 心 技 体 装 as one shared permanent-four component',()=>{
  assert.equal(RINNE_UI_VERSION,'5.2.0');
  assert.match(gameplay,/rinnePrimaryFourMarkup/);assert.match(gameplay,/@soul\/shared-ui\/rinne-primary-four\.css/);
  const order=['data-heart','data-techniques','data-body','data-items'];let cursor=-1;
  for(const attr of order){const next=sharedFour.indexOf(attr);assert.ok(next>cursor,attr);cursor=next;}
  for(const text of ["glyph:'心'","glyph:'技'","glyph:'体'","glyph:'装'"])assert.ok(sharedFour.includes(text),text);
  assert.match(sharedFourCss,/--rinne-four-heart:#e9a6a4/);assert.match(sharedFourCss,/--rinne-four-technique:#91c9dc/);assert.match(sharedFourCss,/--rinne-four-body:#b8b0d7/);assert.match(sharedFourCss,/--rinne-four-items:#e5b579/);
  assert.doesNotMatch(gameplay,/<nav class="rinne-bottom-controls rinne-primary-four"/);assert.doesNotMatch(sharedFour,/<span>/);assert.match(sharedFour,/aria-label/);assert.match(gameplay,/rinneLoadoutPanelMarkup/);assert.match(sharedMenu,/class="rinne-core-menu"/);
});
test('打 is contextual and 記 is auxiliary, neither occupies a core slot',()=>{
  assert.match(gameplay,/<button data-training-strike class="rinne-context-strike"[^>]* hidden>/);
  assert.match(gameplay,/<button data-menu class="rinne-record-toggle"/);
  assert.match(gameplay,/ui\.trainingStrike\.hidden=!engaged\|\|s\.down\|\|s\.ended/);
  assert.match(css,/\.rinne-context-strike\{/);
  assert.match(css,/\.rinne-record-toggle\{/);
});

test('the auxiliary sheet contains only map and lineage record',()=>{
  const hub=gameplay.match(/<aside data-quick-menu class="rinne-quick-menu rinne-secondary-sheet"[\s\S]*?<\/aside>/)?.[0]||'';
  assert.ok(hub);
  assert.doesNotMatch(hub,/data-heart|data-techniques|data-body|data-items|data-training-strike/);
  assert.match(hub,/data-map/);
  assert.match(hub,/data-record/);
});

test('ritual keeps the compact mark and release version is visible',()=>{
  assert.doesNotMatch(family,/family-ritual-brand"[^>]*><img/);
  assert.match(family,/family-memory-hint/);
  assert.match(html,/UI 5\.2\.0 · LOCAL/);
  assert.match(css,/RINNE UI 5\.2\.0/);
});
