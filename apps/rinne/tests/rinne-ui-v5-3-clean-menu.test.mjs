import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RINNE_UI_VERSION} from '../src/ui-version.js';

const gameplay=readFileSync(new URL('../src/gameplay-ui.js',import.meta.url),'utf8');
const body=readFileSync(new URL('../src/heart-technique-body-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/rinne-core-menu.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('UI 5.3 removes the live menu from the retired upgrade-panel CSS contract',()=>{
  assert.equal(RINNE_UI_VERSION,'5.3.0');
  const panel=gameplay.match(/<section data-panel[^>]+>/)?.[0]||'';
  assert.match(panel,/class="rinne-core-menu"/);
  assert.doesNotMatch(panel,/upgrade-panel|rinne-archive-panel/);
  assert.match(css,/\.rinne-core-menu\[hidden\]\{display:none!important\}/);
  assert.doesNotMatch(css,/\.upgrade-panel/);
});

test('game menus lead with choices instead of manual-style intro blocks',()=>{
  assert.doesNotMatch(gameplay,/身につける武具[\s\S]*差し替える/);
  assert.doesNotMatch(body,/intro\('身体の三要素'/);
  assert.doesNotMatch(body,/intro\('三手で連技を組む'/);
  assert.match(body,/rinne-menu-lead/);
});

test('the new menu is a compact game surface and release version is visible',()=>{
  assert.match(css,/max-height:min\(64dvh,620px\)/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/border-radius:24px 24px 18px 18px/);
  assert.match(html,/UI 5\.3\.0 · LOCAL/);
});
