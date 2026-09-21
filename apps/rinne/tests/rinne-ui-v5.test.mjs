import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RINNE_UI_VERSION} from '../src/ui-version.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const gameplay=readFileSync(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
const family=readFileSync(new URL('../src/family-origin-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/rinne-world-ui.css',import.meta.url),'utf8');
const direction=readFileSync(new URL('../docs/UI_5_DIRECTION.md',import.meta.url),'utf8');

test('UI 5 is visible and research principles are persisted',()=>{
  assert.equal(RINNE_UI_VERSION,'5.0.0');
  assert.match(html,/UI 5\.0\.0 · LOCAL/);
  assert.match(direction,/Infinity Nikki/);
  assert.match(direction,/Animal Crossing/);
  assert.match(direction,/Sky: Children of the Light/);
  assert.match(direction,/Genshin Impact/);
});

test('exploration uses one hub plus contextual action instead of persistent system row',()=>{
  assert.match(gameplay,/rinne-explore-controls/);
  assert.match(gameplay,/rinne-function-hub/);
  assert.match(gameplay,/data-menu/);
  assert.match(gameplay,/data-training-strike/);
  const nav=gameplay.match(/<nav class="rinne-bottom-controls rinne-explore-controls"[\s\S]*?<\/nav>/)?.[0]||'';
  assert.doesNotMatch(nav,/data-heart|data-techniques|data-body|data-items|data-map|data-record/);
  const hub=gameplay.match(/<aside data-quick-menu[\s\S]*?<\/aside>/)?.[0]||'';
  for(const key of ['data-heart','data-techniques','data-body','data-items','data-map','data-record'])assert.match(hub,new RegExp(key));
});

test('dialogue declutters gameplay and journal always owns viewport',()=>{
  assert.match(css,/:has\(#dialogue:not\(\[hidden\]\)\)/);
  assert.match(css,/#game-screen \.rinne-gameplay-upgrade \.upgrade-panel\.rinne-archive-panel:not\(\[hidden\]\)[\s\S]*position:fixed/);
  assert.match(gameplay,/gameScreen\.dataset\.archiveOpen='true'/);
  assert.match(gameplay,/delete gameScreen\.dataset\.archiveOpen/);
});

test('family resume action precedes optional lineage history and ritual logo is bounded',()=>{
  assert.match(family,/shell\.append\(closeButton,version,hero,current,actions,memory,historyWrap\)/);
  assert.match(family,/node\(document,'details','family-home-history-wrap'\)/);
  assert.match(css,/\.family-ritual-brand img[\s\S]*width:44px!important/);
  assert.match(css,/family-home-current-v5[\s\S]*border-radius:20px/);
});
