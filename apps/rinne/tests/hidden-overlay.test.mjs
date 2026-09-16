import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appCss=await readFile(new URL('../src/rebuild/app.css',import.meta.url),'utf8');
const polishCss=await readFile(new URL('../src/native-ui-polish.css',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');

test('hidden boot overlays stay hidden even when component CSS authors display',()=>{
  assert.match(appCss,/\.loading-card\{[^}]*display:grid/);
  assert.match(appCss,/\.title-screen\{[^}]*display:grid/);
  assert.match(polishCss,/\[hidden\]\{display:none!important\}/);
  assert.ok(html.indexOf('./src/rebuild/app.css') < html.indexOf('./src/native-ui-polish.css'));
});
