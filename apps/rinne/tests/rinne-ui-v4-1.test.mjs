import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RINNE_UI_VERSION} from '../src/ui-version.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const family=readFileSync(new URL('../src/family-origin-ui.js',import.meta.url),'utf8');
const gameplay=readFileSync(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/rinne-world-ui.css',import.meta.url),'utf8');

test('cute-world release is visibly versioned',()=>{
  assert.equal(RINNE_UI_VERSION,'4.1.0');
  assert.match(html,/UI 4\.1\.0 · LOCAL/);
  assert.match(css,/RINNE UI 4\.1\.0/);
});

test('family resume is above a collapsed lineage drawer',()=>{
  assert.match(family,/node\(document,'details','family-home-history-wrap'\)/);
  assert.match(family,/shell\.append\(closeButton,version,eyebrow,crest,heading,tradition,memory,current,actions,historyWrap\)/);
  assert.match(css,/family-home-history-wrap\[open\]/);
  assert.match(css,/scrollbar-width:none/);
});

test('gameplay journal owns the viewport and hides world HUD while open',()=>{
  assert.match(gameplay,/root\.dataset\.panelOpen='true'/);
  assert.match(gameplay,/gameScreen\.dataset\.archiveOpen='true'/);
  assert.match(css,/rinne-archive-panel:not\(\[hidden\]\)[\s\S]*position:fixed/);
  assert.match(css,/game-screen\[data-archive-open="true"\]>\.objective-card/);
});

test('cute fantasy palette reaches conversation, controls and memory charms',()=>{
  for(const token of ['--r41-peach','--r41-sage','--r41-sky','--r41-honey']) assert.ok(css.includes(token));
  assert.match(css,/#game-screen \.dialogue\.ornate[\s\S]*border-radius:18px/);
  assert.match(css,/\.rinne-command-sigils \.is-heart\{--button-color:#e9aaa4/);
  assert.match(css,/family-origin\[data-memory-id="forest"\]/);
});
