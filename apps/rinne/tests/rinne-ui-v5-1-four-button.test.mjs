import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RINNE_UI_VERSION} from '../src/ui-version.js';

const gameplay=readFileSync(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
const family=readFileSync(new URL('../src/family-origin-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/rinne-world-ui.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('RINNE 5.2 protects 心 技 体 装 as the permanent four',()=>{
  assert.equal(RINNE_UI_VERSION,'5.2.0');
  const block=gameplay.match(/<nav class="rinne-bottom-controls rinne-primary-four"[\s\S]*?<\/nav>/)?.[0]||'';
  assert.ok(block);
  assert.equal((block.match(/<button/g)||[]).length,4);
  const order=['data-heart','data-techniques','data-body','data-items'];
  let cursor=-1;
  for(const attr of order){const next=block.indexOf(attr);assert.ok(next>cursor,attr);cursor=next;}
  for(const text of ['>心<','>技<','>体<','>装<']) assert.ok(block.includes(text),text);
  assert.doesNotMatch(block,/data-training-strike|data-menu|>打<|>記</);
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
