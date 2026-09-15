import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('village keeps build guidance on the build action instead of loose footer prose', async () => {
  const html = await read('apps/village/index.html');
  assert.match(html, /id="build"[^>]+aria-label="つくる。建物や家具を選ぶ"[^>]+title="建物や家具を選ぶ。長押しするとそのまま配置できます"/);
  assert.doesNotMatch(html, /タップで選択 · 長押しで移動/);
});

test('rinne exposes movement guidance as a compact, actionable control', async () => {
  const [html, main, css] = await Promise.all([
    read('apps/rinne/index.html'),
    read('apps/rinne/src/main.js'),
    read('apps/rinne/src/rebuild/button-help.css'),
  ]);
  assert.match(html, /<button id="move-hint"[^>]+aria-label="動きかた。押すと移動操作の説明を表示します"/);
  assert.match(main, /\$\('move-hint'\)\.addEventListener\('click'/);
  assert.match(css, /#move-hint::after\{[\s\S]*content:'動きかた'/);
});

test('demon opens detailed movement controls from a compact help button', async () => {
  const [html, main, css] = await Promise.all([
    read('apps/demon/index.html'),
    read('apps/demon/src/main.js'),
    read('apps/demon/src/web/button-help.css'),
  ]);
  assert.match(html, /<button id="swipe-hint"[^>]+>動きかた<\/button>/);
  assert.match(main, /querySelector\('#swipe-hint'\)\.onclick = \(\) => document\.querySelector\('#pause'\)\?\.click\(\)/);
  assert.match(css, /#swipe-hint\[style\*="opacity: 0"\]/);
});
