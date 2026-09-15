import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('rinne keeps repeated touch controls at a 44px hit target', async () => {
  const css = await read('apps/rinne/src/rebuild/button-help.css');
  assert.match(css, /#move-hint\{[\s\S]*?min-height:44px/);
  assert.match(css, /@media\(pointer:coarse\)\{[\s\S]*?#back-title\{[^}]*min-height:44px/);
});

test('village loads coarse-pointer overrides for compact play controls', async () => {
  const [html, css] = await Promise.all([
    read('apps/village/index.html'),
    read('apps/village/src/web/touch-usability.css'),
  ]);
  assert.match(html, /href="\.\/src\/web\/touch-usability\.css"/);
  assert.match(css, /@media\(pointer:coarse\)/);
  assert.match(css, /#tutorialAction,[\s\S]*?#tabs button,[\s\S]*?\.actions button,[\s\S]*?min-height:44px/);
  assert.match(css, /\.muraHudActions button,[\s\S]*?#dismissTutorial\{[\s\S]*?width:44px;[\s\S]*?height:44px/);
  assert.match(css, /\.rotationControl input\{[\s\S]*?min-height:44px/);
});

test('demon keeps movement and auxiliary touch actions at a 44px hit target', async () => {
  const css = await read('apps/demon/src/web/button-help.css');
  assert.match(css, /#swipe-hint\{[\s\S]*?min-height:44px/);
  assert.match(css, /@media\(pointer:coarse\)\{[\s\S]*?#connection,[\s\S]*?\.title-links button,[\s\S]*?\.first-hunt-choice,[\s\S]*?min-height:44px/);
});
