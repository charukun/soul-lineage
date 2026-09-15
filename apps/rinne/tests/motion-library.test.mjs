import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../motion-library.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../src/review/motion-library.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/review/motion-library.css',import.meta.url),'utf8');

test('Motion Library stays minimal and keyword-only',()=>{
  assert.match(html,/id="library-search"[^>]*type="search"/);
  assert.doesNotMatch(html,/category|filter|sort/i);
  assert.match(html,/id="library-list"/);
  assert.match(html,/id="library-candidate"/);
  assert.match(script,/addEventListener\('input',renderList\)/);
  assert.match(script,/normalize\(clip\.name\)\.includes\(keyword\)/);
});

test('Motion Library previews pinned CC0 KayKit GLBs instead of placeholder motion',()=>{
  assert.match(script,/672074b73ba276876a19e8816ecdc5241817ab47/);
  for(const file of ['Knight.glb','Barbarian.glb','Mage.glb','Rogue.glb','Rogue_Hooded.glb'])assert.match(script,new RegExp(file.replace('.','\\.')));
  assert.match(script,/gltf\.animations/);
  assert.match(script,/mixer\.clipAction\(clip\)/);
  assert.match(script,/raw\.githubusercontent\.com/);
});

test('Motion Library matches Lab styling and uses dense responsive motion grid',()=>{
  assert.match(html,/class="library-brand"/);
  assert.match(html,/Visual Review Lab/);
  assert.match(css,/container-type:inline-size/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.ok(css.includes('@container(min-width:470px){.library-list{grid-template-columns:repeat(4,minmax(0,1fr))'));
  assert.ok(css.includes('@container(min-width:610px){.library-list{grid-template-columns:repeat(5,minmax(0,1fr))'));
  assert.ok(css.includes('@container(min-width:760px){.library-list{grid-template-columns:repeat(6,minmax(0,1fr))'));
  assert.match(css,/\.library-list\{[^}]*overflow-y:auto/);
  assert.match(script,/candidate\?'★'/);
});
