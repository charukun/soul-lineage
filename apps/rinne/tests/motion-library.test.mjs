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

test('Motion Library layout keeps viewer visible while the motion list scrolls',()=>{
  assert.match(css,/grid-template-rows:46px minmax\(0,48dvh\) minmax\(0,1fr\)/);
  assert.match(css,/\.library-list\{[^}]*overflow-y:auto/);
  assert.match(css,/@media\(min-width:760px\)/);
});
