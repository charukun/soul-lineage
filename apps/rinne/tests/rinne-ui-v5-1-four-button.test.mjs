import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RINNE_UI_VERSION} from '../src/ui-version.js';

const gameplay=readFileSync(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
const family=readFileSync(new URL('../src/family-origin-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/rinne-world-ui.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('RINNE 5.1 keeps the four primary controls as a protected contract',()=>{
  assert.equal(RINNE_UI_VERSION,'5.1.0');
  const block=gameplay.match(/<nav class="rinne-bottom-controls rinne-primary-four"[\s\S]*?<\/nav>/)?.[0]||'';
  assert.ok(block);
  assert.equal((block.match(/<button/g)||[]).length,4);
  for(const attr of ['data-heart','data-techniques','data-training-strike','data-menu']) assert.ok(block.includes(attr),attr);
  assert.doesNotMatch(block,/ hidden/);
  assert.match(gameplay,/ui\.trainingStrike\.hidden=false/);
});

test('secondary hand-book contains only secondary systems',()=>{
  const hub=gameplay.match(/<aside data-quick-menu class="rinne-quick-menu rinne-secondary-sheet"[\s\S]*?<\/aside>/)?.[0]||'';
  assert.ok(hub);
  assert.doesNotMatch(hub,/data-heart|data-techniques|data-training-strike/);
  for(const attr of ['data-body','data-items','data-map','data-record']) assert.ok(hub.includes(attr),attr);
});

test('ritual no longer duplicates the title crest at giant scale',()=>{
  assert.doesNotMatch(family,/family-ritual-brand"[^>]*><img/);
  assert.match(family,/family-ritual-brand"[^>]*><i>✦<\/i>/);
  assert.match(family,/family-memory-hint/);
  assert.match(css,/family-memory-relic\{width:112px!important/);
});

test('release version is visible',()=>{
  assert.match(html,/UI 5\.1\.0 · LOCAL/);
  assert.match(css,/RINNE UI 5\.1\.0/);
});
